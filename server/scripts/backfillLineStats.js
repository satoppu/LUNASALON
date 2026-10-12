// LINE公式アカウントの友だち数を、過去にさかのぼって取得・記録する(推移グラフ用。一度だけ実行すればよい)。
// Usage: node scripts/backfillLineStats.js --days 180
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { isLineConfigured, backfillLineStats } = await import("../src/lineInsight.js");
if (!isLineConfigured()) {
  console.error("server/.env に LINE_CHANNEL_ID / LINE_CHANNEL_SECRET を設定してください。");
  process.exit(1);
}
const i = process.argv.indexOf("--days");
const days = i !== -1 ? Number(process.argv[i + 1]) : 180;
const saved = await backfillLineStats(days);
console.log(`過去${days}日分を確認し、${saved}日分を記録しました。`);
