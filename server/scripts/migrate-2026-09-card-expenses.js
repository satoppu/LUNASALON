// 一回限りの本番データ移行スクリプト。楽天カードの9月利用分(11件)を、既に
// seed済みの本番DBに追加する(initialExpenses.jsへの追記と同じ内容)。
// 各行は同じ内容(date/category/amount/source/description/store)の行が既に
// あればスキップするため、誤って2回実行しても重複しない。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-09-card-expenses.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-09-card-expenses.js --apply  # 実際に追加
import db from "../src/db.js";

const INSERTS = [
  { date: "2026-09-24", category: "システム利用料", store: null, amount: 980, description: "ヨヤクル(予約サイト)" },
  { date: "2026-09-20", category: "消耗品費", store: null, amount: 2829, description: "カワチ薬品つくばみどりの" },
  { date: "2026-09-20", category: "消耗品費", store: null, amount: 1980, description: "ファミリーマート柏あけぼのライツ" },
  { date: "2026-09-16", category: "通信費", store: null, amount: 1662, description: "お名前.comサーバー(HP)" },
  { date: "2026-09-10", category: "消耗品費", store: "Bellezza", amount: 3005, description: "柏高島屋" },
  { date: "2026-09-08", category: "消耗品費", store: null, amount: 770, description: "セリア" },
  { date: "2026-09-08", category: "通信費", store: null, amount: 2637, description: "お名前.comサーバー(HP)" },
  { date: "2026-09-07", category: "消耗品費", store: null, amount: 7700, description: "セブンビューティー" },
  { date: "2026-09-05", category: "消耗品費", store: null, amount: 2161, description: "AMAZON" },
  { date: "2026-09-01", category: "通信費", store: null, amount: 550, description: "サブライン(mj-japanの電話)" },
  { date: "2026-09-01", category: "通信費", store: null, amount: 5500, description: "LINE公式(LINE予約)" },
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
