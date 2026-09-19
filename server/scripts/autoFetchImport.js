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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const LOGIN_URL = "https://v3.yoyakul.com/login";
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
// necessarily touching the latter) matches the given pattern.
async function findInputByLiveValue(page, pattern) {
  const idx = await page.evaluate((src) => {
    const re = new RegExp(src);
    return Array.from(document.querySelectorAll("input")).findIndex((el) => re.test(el.value || ""));
  }, pattern.source);
  return idx === -1 ? null : page.locator("input").nth(idx);
}

// "前日" 〜 "3ヶ月後の月末" — e.g. run on 2026-09-19 covers 2026-09-18 through
// 2026-12-31. new Date(y, m, 0) is the last day of month m-1 in local time,
// so passing (targetMonthIndex + 1) as the month lands on the last day of
// the target month.
function formatDate(d) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function dateRange() {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const endOfMonth3Ahead = new Date(today.getFullYear(), today.getMonth() + 4, 0);
  return { from: yesterday, to: endOfMonth3Ahead };
}

async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });
  if (DEBUG) await shot(page, "01-login-page");

  const passwordInput = page.locator('input[type="password"]').first();
  const form = passwordInput.locator("xpath=ancestor::form[1]");
  const idInput = form.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"])').first();
  await idInput.fill(YOYAKUL_ID);
  await passwordInput.fill(YOYAKUL_PASSWORD);
  await page.getByText("ログイン", { exact: true }).click();
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

async function downloadZip(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("下記表をcsv形式でダウンロード").click(),
  ]);
  const filePath = await download.path();
  return { buffer: fs.readFileSync(filePath), filename: download.suggestedFilename() };
}

async function main() {
  // Uses the machine's own installed Google Chrome ("channel: chrome")
  // rather than Playwright's bundled Chromium: the VPS runs Ubuntu 20.04
  // (past its official support window), which Playwright's own browser
  // installer now refuses to target at all — even without --with-deps.
  // A real Chrome .deb install sidesteps that check entirely.
  const browser = await chromium.launch({ channel: "chrome", headless: true, slowMo: DEBUG ? 200 : 0 });
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await login(page);
    await openSalesTab(page);
    await selectDateRange(page);
    const { buffer, filename } = await downloadZip(page);

    const result = importFileBuffer(buffer, filename);
    console.log(new Date().toISOString(), JSON.stringify(result));
    if (result.error) process.exitCode = 1;
  } catch (err) {
    console.error(new Date().toISOString(), "自動取り込みに失敗しました:", err.message);
    await shot(page, "99-error");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
