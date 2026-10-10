// スペースマーケットの通知メールを手動で取り込む(毎朝の autoFetchImport.js
// でも自動で実行される)。初回は --dry-run で読み取り結果だけ確認するとよい。
//
// Usage:
//   node scripts/importSpaceMarketEmails.js --dry-run            # DBは変えず、読み取り結果を表示
//   node scripts/importSpaceMarketEmails.js                      # 反映する
//   node scripts/importSpaceMarketEmails.js --days 30            # 何日前のメールまで見るか(既定14)
//   node scripts/importSpaceMarketEmails.js --baseline --days 60 # 導入時に一度だけ: 今あるメールは反映せず処理済みにする
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { importSpaceMarketEmails, isSpaceMarketMailboxConfigured } = await import("../src/spaceMarketMailbox.js");

if (!isSpaceMarketMailboxConfigured()) {
  console.error("server/.env に SPACEMARKET_IMAP_HOST / SPACEMARKET_IMAP_USER / SPACEMARKET_IMAP_PASSWORD を設定してください。");
  process.exit(1);
}
const daysArg = process.argv.indexOf("--days");
const lookbackDays = daysArg !== -1 ? Number(process.argv[daysArg + 1]) : undefined;
const dryRun = process.argv.includes("--dry-run");
const baseline = process.argv.includes("--baseline");

const { lines, problems } = await importSpaceMarketEmails({ lookbackDays, dryRun, baseline });
console.log(dryRun ? "【読み取り結果(DBは変更していません)】" : baseline ? "【処理済みの印を付けました(反映はしていません)】" : "【反映結果】");
console.log(lines.length ? lines.join("\n") : "対象のメールはありませんでした");
if (problems.length) console.log("\n【要確認】\n" + problems.join("\n"));
