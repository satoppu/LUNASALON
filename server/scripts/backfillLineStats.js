// LINE公式アカウントの友だち数を、過去にさかのぼって取得・記録する(推移グラフ用。一度だけ実行すればよい)。
// 回数制限のため時間がかかるので、裏で動かすとよい:
//   nohup node scripts/backfillLineStats.js --days 180 > logs/line-backfill.log 2>&1 &
// Usage: node scripts/backfillLineStats.js --days 180 [--interval 5]
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
const j = process.argv.indexOf("--interval");
const intervalSec = j !== -1 ? Number(process.argv[j + 1]) : 5;
try {
  const saved = await backfillLineStats(days, { intervalSec });
  console.log(`完了: 過去${days}日分を確認し、新たに${saved}日分を記録しました。`);
} catch (err) {
  console.error(`途中で止まりました(${err.saved ?? 0}日分は記録済み): ${err.message}\n同じコマンドをもう一度実行すると、続きから取得します。`);
  process.exitCode = 1;
}
