// 予約サイト(スペースマーケット・インスタベース)の通知メールを手動で取り込む。
// 毎朝の autoFetchImport.js でも自動で実行される。
//
// Usage:
//   node scripts/importEmails.js --dry-run                       # DBは変えず、読み取り結果を表示
//   node scripts/importEmails.js                                 # 反映する
//   node scripts/importEmails.js --days 30                       # 何日前のメールまで見るか(既定14)
//   node scripts/importEmails.js --source instabase              # 取り込み元を1つに絞る(spacemarket / instabase)
//   node scripts/importEmails.js --baseline --days 60 --source instabase
//                                                                # 導入時に一度だけ: 今あるメールは反映せず処理済みにする
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { importPlatformEmails, configuredSources, EMAIL_SOURCES } = await import("../src/emailImport.js");

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : undefined;
};
const only = arg("--source");
const lookbackDays = arg("--days") ? Number(arg("--days")) : undefined;
const dryRun = process.argv.includes("--dry-run");
const baseline = process.argv.includes("--baseline");

if (only && !EMAIL_SOURCES.some((s) => s.key === only)) {
  console.error(`--source は ${EMAIL_SOURCES.map((s) => s.key).join(" / ")} のどれかを指定してください。`);
  process.exit(1);
}
const targets = configuredSources().filter((s) => !only || s.key === only);
if (targets.length === 0) {
  console.error("server/.env にメールの設定(SPACEMARKET_IMAP_* または INSTABASE_IMAP_*)がありません。");
  process.exit(1);
}

const outcomes = await importPlatformEmails({ lookbackDays, dryRun, baseline, only });
const heading = dryRun ? "読み取り結果(DBは変更していません)" : baseline ? "処理済みの印を付けました(反映はしていません)" : "反映結果";
for (const { source, result, error } of outcomes) {
  console.log(`\n【${source.label}: ${heading}】`);
  if (error) {
    console.log(`失敗しました: ${error.message}`);
    continue;
  }
  console.log(result.lines.length ? result.lines.join("\n") : "対象のメールはありませんでした");
  if (result.problems.length) console.log("\n【要確認】\n" + result.problems.join("\n"));
}
