// Nightly automation: logs into the よやクルPro reservation platform
// (v3.yoyakul.com) — the actual booking system behind 自社サイト — downloads
// the same 売り上げ情報 zip export a person would download by hand, and
// feeds it straight into the existing importFileBuffer() pipeline (same
// zip/xlsx/csv detection, business rules, and upsert/dedup behavior as a
// manual "インポート" upload from the dashboard header, just unattended).
//
// Runs on the VPS itself (same machine as the dashboard server, since it
// writes directly to server/luna.db) via a daily cron job — see README.md
// "自動取り込み" for setup. The VPS is headless, so this always launches
// Chromium headless; --debug only adds a screenshot after every step
// (server/scripts/debug-shots/) and slows each action down, for diagnosing
// a selector that no longer matches the real site.
//
// Credentials come from server/.env (YOYAKUL_ID / YOYAKUL_PASSWORD), which
// is git-ignored — never commit real credentials. Copy server/.env.example
// to server/.env and fill in the real values there.
//
// Usage:
//   node scripts/autoFetchImport.js            # normal, unattended run
//   node scripts/autoFetchImport.js --debug    # extra screenshots + slowMo,
//                                               # for tuning selectors
//                                               # against the real site
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { importFileBuffer } from "../src/importFileBuffer.js";
import { sendResultEmail } from "../src/notifyEmail.js";
import { getNewBookingsDaily, getNewCustomersOnDate } from "../src/newBookingsDaily.js";
import { importPlatformEmails, formatEmailImportSection } from "../src/emailImport.js";
import { hasKnownCustomers, findNewCustomers, saveCustomers, formatNewRegistrations } from "../src/yoyakulCustomers.js";
import { updateLineStats } from "../src/lineInsight.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const LOGIN_URL = "https://v3.yoyakul.com/login";
// ?page=daily はApp.jsxのinitialViewFromURLが読み、初期表示ページを
// 「日次動向」にする(通常はサイドバー操作のみでURLと連動しない)。
const DASHBOARD_DAILY_URL = "https://apps.lunasalon.jp/?page=daily";
const YOYAKUL_ID = process.env.YOYAKUL_ID;
const YOYAKUL_PASSWORD = process.env.YOYAKUL_PASSWORD;
const DEBUG = process.argv.includes("--debug");
const DEBUG_DIR = path.join(__dirname, "debug-shots");

if (!YOYAKUL_ID || !YOYAKUL_PASSWORD) {
  console.error("server/.env に YOYAKUL_ID / YOYAKUL_PASSWORD を設定してください(server/.env.example を参照)。");
  process.exit(1);
}

async function shot(page, label) {
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  await page.screenshot({ path: path.join(DEBUG_DIR, `${label}.png`), fullPage: true }).catch(() => {});
}

// Dumps every <input>'s live properties (not just its initial HTML
// attributes, which a JS-driven widget may never touch) so a selector that
// stops matching can be diagnosed from this file alone, without another
// round of screenshots.
async function dumpInputs(page, label) {
  const inputs = await page.$$eval("input", (els) =>
    els.map((e) => ({ type: e.type, id: e.id, name: e.name, className: e.className, value: e.value, placeholder: e.placeholder }))
  );
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  fs.writeFileSync(path.join(DEBUG_DIR, `${label}-inputs.json`), JSON.stringify(inputs, null, 1));
}

// Finds the <input> whose current value (live DOM property, not the
// original HTML attribute — a JS widget updates the former without
// necessarily touching the latter) matches the given pattern. This is a
// one-shot synchronous DOM scan, not an auto-waiting Playwright locator —
// if the page's JS widget hasn't finished populating the field's default
// value yet even though `networkidle` already fired (observed in
// production: a manual re-run right after an unexplained failure succeeded
// with no code change), a single immediate scan can race and find nothing.
// Polling for a few seconds absorbs that race instead of failing outright.
async function findInputByLiveValue(page, pattern, { timeoutMs = 10000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const idx = await page.evaluate((src) => {
      const re = new RegExp(src);
      return Array.from(document.querySelectorAll("input")).findIndex((el) => re.test(el.value || ""));
    }, pattern.source);
    if (idx !== -1) return page.locator("input").nth(idx);
    if (Date.now() >= deadline) return null;
    await page.waitForTimeout(intervalMs);
  }
}

// "前日" 〜 "6ヶ月後の月末" — e.g. run on 2026-09-19 covers 2026-09-18 through
// 2027-03-31. new Date(y, m, 0) is the last day of month m-1 in local time,
// so passing (targetMonthIndex + 1) as the month lands on the last day of
// the target month. 6ヶ月先まで取ることで、よやクルPro側で予約できる最大
// 期間を毎日カバーし続け、cancelled_date(importService.jsが最初にキャンセル
// への変化を検知した日をJSTで記録)が実際のキャンセル日とズレないようにする
// — 取り込み漏れの空白期間があると、その間にキャンセルされた予約は後から
// (利用日を過ぎて欠落に気づいた時などに)しか検知できず、cancelled_dateが
// 実際より遅れてしまう。
function formatDate(d) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function dateRange() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const endOfMonth6Ahead = new Date(today.getFullYear(), today.getMonth() + 7, 0);
  return { from: yesterday, to: endOfMonth6Ahead };
}

// ログインボタンの表示(文言・タグ)はサイト側の更新で変わることがあるため、
// 見つかりやすい順に試し、どれも無ければパスワード欄でEnterを押して送信する。
async function submitLogin(page, form, passwordInput) {
  const candidates = [
    page.getByRole("button", { name: /ログイン/ }),
    form.locator('button[type="submit"], input[type="submit"]'),
    page.getByText("ログイン", { exact: true }),
  ];
  for (const candidate of candidates) {
    const button = candidate.first();
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return;
    }
  }
  // ボタンが見つからなければフォームを直接送信する(フォームでなければEnterで送信)。
  const submitted = await form.evaluate((f) => (f.requestSubmit(), true)).catch(() => false);
  if (!submitted) await passwordInput.press("Enter");
}

async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });
  if (DEBUG) await shot(page, "01-login-page");

  const passwordInput = page.locator('input[type="password"]').first();
  const form = passwordInput.locator("xpath=ancestor::form[1]");
  const idInput = form.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"])').first();
  await idInput.fill(YOYAKUL_ID);
  await passwordInput.fill(YOYAKUL_PASSWORD);
  await submitLogin(page, form, passwordInput);
  await page.waitForLoadState("networkidle");
  if (DEBUG) await shot(page, "02-after-login");

  if (page.url().includes("/login")) {
    throw new Error("ログインに失敗しました(ログイン画面のまま)。IDまたはPASSWORDを確認してください。");
  }
}

async function openSalesTab(page) {
  await page.getByText("売り上げ情報").click();
  await page.waitForLoadState("networkidle");
  if (DEBUG) {
    await shot(page, "03-sales-tab");
    await dumpInputs(page, "03-sales-tab");
  }
}

// The date-range field is a plain text <input> whose value is a single
// "YYYY/MM/DD - YYYY/MM/DD" string — clicking it opens a two-month calendar
// below (purely a visual aid; it stays in sync with whatever you type), and
// typing over the text directly re-sets the range. No separate "決定" click
// is needed: clicking 切り替え afterward both closes the picker and reloads
// the table for the typed range.
async function selectDateRange(page) {
  const { from, to } = dateRange();
  const desired = `${formatDate(from)} - ${formatDate(to)}`;
  const DATE_RANGE_VALUE_RE = /^\d{4}\/\d{2}\/\d{2}\s*-\s*\d{4}\/\d{2}\/\d{2}$/;

  const dateRangeInput = await findInputByLiveValue(page, DATE_RANGE_VALUE_RE);
  if (!dateRangeInput) {
    throw new Error(
      "日付範囲の入力欄が見つかりませんでした。server/scripts/debug-shots/03-sales-tab-inputs.json を確認し、" +
        "selectDateRange() を実際のUIに合わせて修正してください。"
    );
  }
  await dateRangeInput.click();
  if (DEBUG) {
    await shot(page, "04-date-range-opened");
    await dumpInputs(page, "04");
  }

  await dateRangeInput.press("Control+a");
  await page.keyboard.type(desired, { delay: 20 });
  if (DEBUG) await shot(page, "05-date-range-filled");

  await page.getByText("切り替え", { exact: true }).click();
  await page.waitForLoadState("networkidle");
  if (DEBUG) await shot(page, "06-after-switch");
}

function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

// 取り込み成功メールに添える「前日」の日次動向サマリー — 日次動向ページの
// 棒グラフのツールチップ(newBookingsDaily.js)と同じ用語・同じ値。この
// スクリプトはbooking_date=前日までの分を確定させる形で毎朝動くため、
// 直近で内容が固まっている「前日」を報告対象にする。
function formatDailySummary(registrations, lineSection) {
  const days = getNewBookingsDaily(0);
  const y = days[days.length - 1];
  const totalCount = y.count + y.subscriptionCount + y.cancelCount;
  return (
    `日付：${y.date}\n` +
    `予約：${y.count}件　予売：${yen(y.bookingRevenue)}\n` +
    `定額：${y.subscriptionCount}件　定売：${yen(y.subscriptionRevenue)}\n` +
    `取消：${y.cancelCount}件　消売：${y.cancelRevenue > 0 ? "-" + yen(y.cancelRevenue) : yen(0)}\n\n` +
    `合計：${totalCount}件　合売：${yen(y.revenue)}` +
    formatNewCustomers(y.date) +
    formatNewRegistrations(registrations) +
    lineSection
  );
}

const CHANNEL_LABEL = { Instabase: "インスタベース" };

// 前日に初めて予約(・利用・定額クーポン購入)したお客様の一覧。
function formatNewCustomers(dateISO) {
  const list = getNewCustomersOnDate(dateISO);
  if (list.length === 0) return "\n\n新規のお客様：なし";
  const lines = list.map((c) => {
    const what = c.channel === "定期クーポン" ? "定額クーポン購入" : `${Number(c.date.slice(5, 7))}/${Number(c.date.slice(8, 10))}利用`;
    return `・${c.user}（${CHANNEL_LABEL[c.channel] ?? c.channel}／${c.store}・${what}）`;
  });
  return `\n\n新規のお客様：${list.length}名\n${lines.join("\n")}`;
}

const CUSTOMER_LIST_URL = "https://v3.yoyakul.com/owner/customer";
const MAX_DETAIL_LOOKUPS = 10;

// 「顧客情報」の一覧(お名前・HN・お電話番号・email の表)を読む。行に詳細ページへの
// リンクがあれば、そのID(?id=…)も控える。
async function readCustomerList(page) {
  await page.goto(CUSTOMER_LIST_URL, { waitUntil: "networkidle" });
  if (DEBUG) await shot(page, "10-customer-list");
  const rows = await page.evaluate(() => {
    const table = [...document.querySelectorAll("table")].find((t) => /HN/.test(t.innerText) && /email/i.test(t.innerText));
    if (!table) return null;
    return [...table.querySelectorAll("tr")]
      .map((tr, index) => {
        const cells = [...tr.querySelectorAll("td")].map((td) => td.innerText.trim());
        if (cells.length < 4) return null;
        const holder = tr.querySelector('a[href*="id="]') || tr.closest('a[href*="id="]');
        const source = holder?.getAttribute("href") || tr.getAttribute("onclick") || tr.getAttribute("data-href") || "";
        const detailId = source.match(/id=([\w-]+)/)?.[1] ?? null;
        return { index, name: cells[0], hn: cells[1], phone: cells[2], email: cells[3], detailId };
      })
      .filter(Boolean);
  });
  if (!rows) throw new Error("顧客情報の一覧(表)が見つかりませんでした");
  return rows;
}

// 会員の詳細ページを開いて「登録日」を読む(IDが分かればURLで、分からなければ一覧の行をクリックして)。
async function readRegisteredDate(page, row) {
  if (row.detailId) {
    await page.goto(`${CUSTOMER_LIST_URL}/detail?id=${row.detailId}`, { waitUntil: "networkidle" });
  } else {
    await page.goto(CUSTOMER_LIST_URL, { waitUntil: "networkidle" });
    await page.locator("tr").nth(row.index).click();
    await page.waitForURL(/customer\/detail/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
  }
  return page.evaluate(() => {
    const label = [...document.querySelectorAll("th, td, div, span, dt")].find((el) => el.innerText?.trim() === "登録日");
    const value = label?.nextElementSibling?.innerText?.trim();
    const m = value?.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : null;
  });
}

// 前回以降に会員登録した方を見つける。初回は今の会員を記録するだけ(全員を新規と扱わない)。
async function collectNewRegistrations(page) {
  const rows = await readCustomerList(page);
  if (!hasKnownCustomers()) {
    saveCustomers(rows);
    return { baseline: true, total: rows.length };
  }
  const newOnes = findNewCustomers(rows);
  for (const row of newOnes.slice(0, MAX_DETAIL_LOOKUPS)) {
    row.registeredDate = await readRegisteredDate(page, row).catch(() => null);
  }
  saveCustomers(newOnes);
  return { baseline: false, newOnes };
}

async function downloadZip(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("下記表をcsv形式でダウンロード").click(),
  ]);
  const filePath = await download.path();
  return { buffer: fs.readFileSync(filePath), filename: download.suggestedFilename() };
}

// スペースマーケット・インスタベースの通知メールの取り込み。よやクルProの取り込みが
// 失敗しても動くよう独立して実行し、結果は同じ通知メールに添える。
async function runPlatformEmails() {
  try {
    const outcomes = await importPlatformEmails();
    for (const o of outcomes) console.log(new Date().toISOString(), o.source.label, o.error ? o.error.message : JSON.stringify(o.result));
    return formatEmailImportSection(outcomes);
  } catch (err) {
    console.error(new Date().toISOString(), "メール取り込みに失敗しました:", err.message);
    return `\n\n----------------\n\nメール取り込みに失敗しました。\n${err.message}`;
  }
}

// ログイン画面が表示されない等の一時的な不調(サイト側の朝のメンテナンス・回線の瞬断)で
// 失敗することがあるため、少し待って1回だけやり直す。
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 3 * 60 * 1000;
const ERROR_SHOT = path.join(DEBUG_DIR, "99-error.png");

async function fetchFromYoyakul(browser) {
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await login(page);
    await openSalesTab(page);
    await selectDateRange(page);
    const downloaded = await downloadZip(page);
    // 新規会員の確認は、失敗しても売上の取り込みは続ける(メールに「取得できませんでした」と出す)。
    const registrations = await collectNewRegistrations(page).catch((err) => ({ error: err.message }));
    return { ...downloaded, registrations };
  } catch (err) {
    // 失敗時の画面を残し、どこで止まったか分かるようにURLとタイトルもエラーに添える。
    await shot(page, "99-error");
    const where = `${await page.title().catch(() => "?")} (${page.url()})`;
    throw new Error(`${err.message}\n\n失敗時の画面: ${where}`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function main() {
  // 前回の失敗時の画面が今回のメールに添付されないよう、最初に消しておく。
  fs.rmSync(ERROR_SHOT, { force: true });
  const emailSection = await runPlatformEmails();
  // LINEの友だち数(未設定なら空)。取れなくても取り込みは続ける。
  const lineSection = await updateLineStats().catch((err) => `\n\nLINE：取得できませんでした(${err.message})`);
  // Uses the machine's own installed Google Chrome ("channel: chrome")
  // rather than Playwright's bundled Chromium: the VPS runs Ubuntu 20.04
  // (past its official support window), which Playwright's own browser
  // installer now refuses to target at all — even without --with-deps.
  // A real Chrome .deb install sidesteps that check entirely.
  const browser = await chromium.launch({ channel: "chrome", headless: true, slowMo: DEBUG ? 200 : 0 });
  try {
    let downloaded;
    for (let attempt = 1; ; attempt++) {
      try {
        downloaded = await fetchFromYoyakul(browser);
        break;
      } catch (err) {
        if (attempt >= MAX_ATTEMPTS) throw err;
        console.error(new Date().toISOString(), `よやクルProの取得に失敗(${attempt}回目)。${RETRY_DELAY_MS / 60000}分後にやり直します:`, err.message);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    const { buffer, filename, registrations } = downloaded;

    const result = importFileBuffer(buffer, filename);
    console.log(new Date().toISOString(), JSON.stringify(result));
    if (result.error) {
      process.exitCode = 1;
      // 原因調査用に、取り込めなかったファイルを残す(debug-shots/ はgit管理外)。
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
      const savedPath = path.join(DEBUG_DIR, `failed-${new Date().toISOString().slice(0, 10)}-${filename}`);
      fs.writeFileSync(savedPath, buffer);
      await sendResultEmail({
        subject: "【LUNA】自動取り込み失敗",
        text: `よやクルProからの自動取り込みでエラーが発生しました。\n\n${result.error}\n\nダウンロードしたファイル: ${savedPath}` + emailSection,
      }).catch((e) => console.error("メール通知に失敗しました:", e.message));
    } else {
      await sendResultEmail({
        subject: "【LUNA】自動取り込み成功",
        text:
          // 順番: 前日のまとめ → スペースマーケット → インスタベース → よやクルProの取り込み結果
          formatDailySummary(registrations, lineSection) +
          `\n\n${DASHBOARD_DAILY_URL}` +
          emailSection +
          `\n\n----------------\n\n` +
          `よやクルProからの自動取り込みが完了しました。\n\n` +
          `新規登録: ${result.inserted}件\n` +
          `更新: ${result.updated}件\n` +
          `重複スキップ: ${result.duplicates}件\n` +
          `期間対象外スキップ: ${result.skipped}件\n` +
          `解析不能スキップ: ${result.skippedUnparseable}件\n` +
          `解決不能/不正: ${result.unresolvedOrBad}件`,
      }).catch((e) => console.error("メール通知に失敗しました:", e.message));
    }
  } catch (err) {
    console.error(new Date().toISOString(), "自動取り込みに失敗しました:", err.message);
    process.exitCode = 1;
    await sendResultEmail({
      subject: "【LUNA】自動取り込み失敗",
      text:
        `よやクルProからの自動取り込みが失敗しました(${MAX_ATTEMPTS}回試しました)。\n\n${err.message}\n\n` +
        `失敗時の画面を添付しています。` +
        emailSection,
      attachments: fs.existsSync(ERROR_SHOT) ? [{ filename: "error.png", path: ERROR_SHOT }] : undefined,
    }).catch((e) => console.error("メール通知に失敗しました:", e.message));
  } finally {
    await browser.close();
  }
}

main();
