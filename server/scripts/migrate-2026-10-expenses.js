// 一回限りの本番データ移行スクリプト。2026年10月28日に受け取った銀行明細
// (9/29〜10/27)と楽天カード10月請求分のうち、まだ経費に入っていない13件を、
// 既にseed済みの本番DBに追加する(initialExpenses.jsへの追記と同じ内容)。
// 楽天カードの引き落とし(明細の各行を別に登録済み)・カブアンド(個人の投資)・
// 売上の入金は経費ではないため含めない。
// 各行は同じ内容(date/category/amount/source/description/store)の行が既に
// あればスキップするため、誤って2回実行しても重複しない。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-10-expenses.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-10-expenses.js --apply  # 実際に追加
import db from "../src/db.js";

const INSERTS = [
  { date: "2026-09-29", category: "水道光熱費", store: "Bellezza", amount: 7480, description: "ジャパンデンリョク", source: "card_rakuten" },
  { date: "2026-10-07", category: "家賃", store: "Forest", amount: 10000, description: "カーサ(更新関連費用)", source: "bank" },
  { date: "2026-10-07", category: "支払手数料", store: null, amount: 154, description: "フリコミ　テスウリヨウ", source: "bank" },
  { date: "2026-10-09", category: "水道光熱費", store: "Bellezza", amount: 1197, description: "京葉ガス", source: "bank" },
  { date: "2026-10-09", category: "水道光熱費", store: "Forest", amount: 1330, description: "京葉ガス", source: "bank" },
  { date: "2026-10-11", category: "雑費", store: null, amount: 5192, description: "ＲＴＫ　ペイペイ", source: "bank" },
  { date: "2026-10-13", category: "家賃", store: "Asteria", amount: 18600, description: "エイビイシー(駐車場 初期費用)", source: "bank" },
  { date: "2026-10-13", category: "支払手数料", store: null, amount: 154, description: "フリコミ　テスウリヨウ", source: "bank" },
  { date: "2026-10-15", category: "水道光熱費", store: "Asteria", amount: 1881, description: "東京電力", source: "bank" },
  { date: "2026-10-26", category: "水道光熱費", store: "Asteria", amount: 2962, description: "エネサンス(ASTERIA電気代)", source: "bank" },
  { date: "2026-10-27", category: "通信費", store: null, amount: 8853, description: "楽天モバイル(Wifi)", source: "bank" },
  { date: "2026-10-27", category: "家賃", store: "Bellezza", amount: 72930, description: "ヤチントウ(家賃)", source: "bank" },
  { date: "2026-10-27", category: "家賃", store: "Forest", amount: 72930, description: "ヤチントウ(家賃)", source: "bank" },
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
