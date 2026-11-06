// 一回限りの本番データ移行スクリプト。楽天カードの10月利用分(11月請求)のうち、
// まだ経費に入っていない9件を、既にseed済みの本番DBに追加する
// (initialExpenses.jsへの追記と同じ内容)。ダイソー・salut!(明細では
// テンジンチカガイ 990円)・ナチュラルキッチン(同 7,161円)は登録済みのため含めない。
// セブンビューティーは柏の2店舗(Bellezza・Forest)用のため半分ずつに分ける。
// 分割払いの2回目以降(8月購入分)は購入時に全額を登録済みのため含めない。
// 各行は同じ内容(date/category/amount/source/description/store)の行が既に
// あればスキップするため、誤って2回実行しても重複しない。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-10-card-expenses.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-10-card-expenses.js --apply  # 実際に追加
import db from "../src/db.js";

const INSERTS = [
  { date: "2026-10-01", category: "通信費", store: null, amount: 550, description: "サブライン(mj-japanの電話)" },
  { date: "2026-10-01", category: "通信費", store: null, amount: 5500, description: "LINE公式(LINE予約)" },
  { date: "2026-10-08", category: "通信費", store: null, amount: 4299, description: "お名前.comサーバー(HP)" },
  { date: "2026-10-14", category: "消耗品費", store: "Asteria", amount: 4950, description: "セリア フォルテつくば店" },
  { date: "2026-10-19", category: "広告宣伝費", store: "Asteria", amount: 4181, description: "Instagram広告(平日割)" },
  { date: "2026-10-24", category: "システム利用料", store: null, amount: 980, description: "ヨヤクル(予約サイト)" },
  { date: "2026-10-27", category: "水道光熱費", store: "Bellezza", amount: 6373, description: "ジャパンデンリョク" },
  { date: "2026-10-27", category: "消耗品費", store: "Bellezza", amount: 2849, description: "セブンビューティー(コットン・ペーパーシーツ)" },
  { date: "2026-10-27", category: "消耗品費", store: "Forest", amount: 2849, description: "セブンビューティー(コットン・ペーパーシーツ)" },
].map((e) => ({ ...e, source: "card_rakuten" }));

const apply = process.argv.includes("--apply");

const findDup = db.prepare(
  `SELECT id FROM expenses WHERE date = ? AND category = ? AND amount = ? AND source = ? AND description = ? AND store IS ?`
);
const doInsert = db.prepare(
  `INSERT INTO expenses (date, category, store, amount, description, source) VALUES (?, ?, ?, ?, ?, ?)`
);

const checks = INSERTS.map((e) => ({ e, existing: findDup.get(e.date, e.category, e.amount, e.source, e.description, e.store) }));
for (const { e, existing } of checks) {
  console.log(`${e.date} ${e.category} ¥${e.amount} "${e.description}"(${e.store || "店舗未指定"}) — ${existing ? "既にあり(スキップ)" : "新規"}`);
}

if (!apply) {
  console.log("dry-runのため追加はしていません。実際に反映するには --apply を付けて再実行してください。");
  process.exit(0);
}

db.exec("BEGIN");
try {
  let inserted = 0;
  for (const { e, existing } of checks) {
    if (existing) continue;
    doInsert.run(e.date, e.category, e.store, e.amount, e.description, e.source);
    inserted += 1;
  }
  db.exec("COMMIT");
  console.log(`${inserted}件を追加しました。`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("追加中にエラーが発生したため、すべて取り消しました:", err);
  process.exit(1);
}
