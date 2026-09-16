// Nightly automation: logs into the よやクルPro reservation platform
// (v3.yoyakul.com), downloads the same 売り上げ情報 CSV export a person would
// download by hand, and feeds it straight into the existing importCsv()
// pipeline (server/src/importService.js) — same auto-format-detection,
// business rules, and upsert/dedup behavior as a manual "CSVインポート"
// upload, just unattended.
//
// This must run on the same machine as the dashboard server (it writes
// directly to server/luna.db via importCsv, no HTTP call to the running
// server needed), scheduled nightly via Windows Task Scheduler — see
// README.md "自動取り込み" for setup.
//
// Credentials come from server/.env (YOYAKUL_ID / YOYAKUL_PASSWORD), which is
// git-ignored — never commit real credentials. Copy server/.env.example to
// server/.env and fill in the real values there.
//
// Usage:
//   node scripts/autoFetchImport.js            # normal, unattended run
//   node scripts/autoFetchImport.js --debug    # visible browser + screenshots
//                                               # after each step, for tuning
//                                               # selectors against the real site
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { importCsv } from "../src/importService.js";

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
  if (!DEBUG) return;
  fs.mkdirSync(DEBUG_DIR, { recursive: true });
  await page.screenshot({ path: path.join(DEBUG_DIR, `${label}.png`), fullPage: true });
}

function formatDate(d) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

async function login(page) {
  await page.goto(LOGIN_URL, { waitUntil: "networkidle" });
  await shot(page, "01-login-page");

  const passwordInput = page.locator('input[type="password"]').first();
  const form = passwordInput.locator("xpath=ancestor::form[1]");
  const idInput = form.locator('input:not([type="password"]):not([type="hidden"]):not([type="submit"])').first();
  await idInput.fill(YOYAKUL_ID);
  await passwordInput.fill(YOYAKUL_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForLoadState("networkidle");
  await shot(page, "02-after-login");
}

async function openSalesTab(page) {
  await page.getByText("売り上げ情報").click();
  await page.waitForLoadState("networkidle");
  await shot(page, "03-sales-tab");
}

// TODO: the date-range picker's actual markup isn't known yet (this
// environment can't reach v3.yoyakul.com to inspect it — see conversation).
// Currently assumes clicking the "YYYY/MM/DD - YYYY/MM/DD" field opens a
// calendar with two date <input>s that accept typed dates directly. Run with
// --debug, check server/scripts/debug-shots/04-date-range-opened.png against
// what actually appears, and adjust this function to match.
async function selectDateRange(page) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const threeMonthsAhead = new Date(today);
  threeMonthsAhead.setMonth(threeMonthsAhead.getMonth() + 3);

  const dateRangeField = page.getByText(/^\d{4}\/\d{2}\/\d{2}\s*-\s*\d{4}\/\d{2}\/\d{2}$/).first();
  await dateRangeField.click();
  await shot(page, "04-date-range-opened");

  const dateInputs = page.locator('input[type="date"], input[placeholder*="/"]');
  if ((await dateInputs.count()) >= 2) {
    await dateInputs.nth(0).fill(formatDate(yesterday));
    await dateInputs.nth(1).fill(formatDate(threeMonthsAhead));
  } else {
    throw new Error(
      "日付範囲の入力欄が見つかりませんでした。server/scripts/debug-shots/04-date-range-opened.png を確認し、" +
        "selectDateRange() を実際のUIに合わせて修正してください。"
    );
  }
  await shot(page, "05-date-range-filled");

  await page.getByRole("button", { name: "切り替え" }).click();
  await page.waitForLoadState("networkidle");
  await shot(page, "06-after-switch");
}

async function downloadCsv(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByText("下記表をcsv形式でダウンロード").click(),
  ]);
  const csvPath = await download.path();
  return fs.readFileSync(csvPath, "utf-8");
}

async function main() {
  const browser = await chromium.launch({ headless: !DEBUG, slowMo: DEBUG ? 200 : 0 });
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await login(page);
    await openSalesTab(page);
    await selectDateRange(page);
    const csvText = await downloadCsv(page);

    const result = importCsv(csvText);
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
