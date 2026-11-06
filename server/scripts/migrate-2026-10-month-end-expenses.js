// 一回限りの本番データ移行スクリプト。銀行明細の 10/28〜10/31 分(月末の家賃・
// 駐車場代・水道代)5件を、既にseed済みの本番DBに追加する
// (initialExpenses.jsへの追記と同じ内容)。売上の入金(GMOイプシロン・
// インスタベース・スペースマーケット)は経費ではないため含めない。
// 駐車場はオーナーズワンからエイビイシーに契約を移したため、オーナーズワンの
// 家賃は 64,300円 → 57,700円 になっている。
// 各行は同じ内容(date/category/amount/source/description/store)の行が既に
// あればスキップするため、誤って2回実行しても重複しない。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-10-month-end-expenses.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-10-month-end-expenses.js --apply  # 実際に追加
import db from "../src/db.js";

const INSERTS = [
  { date: "2026-10-29", category: "家賃", store: "Asteria", amount: 57700, description: "オーナーズワン(家賃)", source: "bank" },
  { date: "2026-10-29", category: "家賃", store: "Asteria", amount: 6000, description: "エイビイシー(駐車場代)", source: "bank" },
  { date: "2026-10-29", category: "支払手数料", store: null, amount: 220, description: "フリコミ　テスウリヨウ", source: "bank" },
  { date: "2026-10-30", category: "水道光熱費", store: "Bellezza", amount: 4389, description: "水道代(RTK)", source: "bank" },
  { date: "2026-10-30", category: "水道光熱費", store: "Forest", amount: 4389, description: "水道代(RTK)", source: "bank" },
];

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
