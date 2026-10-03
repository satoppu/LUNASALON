// 一回限りの本番データ移行スクリプト。9月分の銀行明細を反映するための
// initialExpenses.js への追記(新規7行)と、柏高島屋の店舗を確定できた
// ことによる既存2行の店舗更新を、既にseed済みの本番DBにも反映する。
// 新規行は(date/category/amount/source/description/store IS NULL)の組み合わせで
// 既に同じ内容の行が無いことを確認してから挿入し(誤って2回実行しても
// 重複しない)、更新対象の2行も「変更前の内容の行がちょうど1件」の場合のみ
// 更新する。1件でも想定と食い違えば、何も書き換えずに中断する。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-09-expenses.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-09-expenses.js --apply  # 実際に更新
import db from "../src/db.js";

const UPDATES = [
  { date: "2026-08-06", category: "消耗品費", amount: 4015, source: "card_rakuten", oldDesc: "柏高島屋", newStore: "Bellezza", newDesc: "柏高島屋" },
  { date: "2026-08-06", category: "消耗品費", amount: 1320, source: "card_rakuten", oldDesc: "柏高島屋", newStore: "Bellezza", newDesc: "柏高島屋" },
];

const INSERTS = [
  { date: "2026-09-28", category: "水道光熱費", store: "Asteria", amount: 3062, description: "エネサンス(ASTERIA電気代)", source: "bank" },
  { date: "2026-09-28", category: "通信費", store: null, amount: 8853, description: "楽天モバイル(Wifi)", source: "bank" },
  { date: "2026-09-28", category: "家賃", store: "Bellezza", amount: 72930, description: "ヤチントウ(家賃)", source: "bank" },
  { date: "2026-09-28", category: "家賃", store: "Forest", amount: 72930, description: "ヤチントウ(家賃)", source: "bank" },
  { date: "2026-09-30", category: "家賃", store: "Asteria", amount: 6000, description: "エイビイシー(駐車場代)", source: "bank" },
  { date: "2026-09-30", category: "家賃", store: "Asteria", amount: 64300, description: "オーナーズワン(家賃)", source: "bank" },
  { date: "2026-09-30", category: "支払手数料", store: null, amount: 220, description: "フリコミ　テスウリヨウ", source: "bank" },
];

const apply = process.argv.includes("--apply");

const findForUpdate = db.prepare(
  `SELECT id FROM expenses WHERE date = ? AND category = ? AND amount = ? AND source = ? AND description = ? AND store IS NULL`
);
const doUpdate = db.prepare(`UPDATE expenses SET store = ?, description = ? WHERE id = ?`);

const findForInsertDup = db.prepare(
  `SELECT id FROM expenses WHERE date = ? AND category = ? AND amount = ? AND source = ? AND description = ? AND store IS ?`
);
const doInsert = db.prepare(
  `INSERT INTO expenses (date, category, store, amount, description, source) VALUES (?, ?, ?, ?, ?, ?)`
);

const updateMatches = UPDATES.map((u) => ({ u, rows: findForUpdate.all(u.date, u.category, u.amount, u.source, u.oldDesc) }));
const badUpdates = updateMatches.filter((m) => m.rows.length !== 1);
if (badUpdates.length > 0) {
  console.error(`中断: 更新対象${badUpdates.length}件が「変更前の内容の行がちょうど1件」に該当しませんでした。`);
  for (const m of badUpdates) {
    console.error(`  [${m.rows.length}件一致] ${m.u.date} ${m.u.category} ¥${m.u.amount} "${m.u.oldDesc}"`);
  }
  process.exit(1);
}

const insertChecks = INSERTS.map((e) => ({
  e,
  existing: findForInsertDup.get(e.date, e.category, e.amount, e.source, e.description, e.store),
}));

console.log(`更新: ${UPDATES.length}件すべて、変更前の内容と一致する行が1件ずつ見つかりました。`);
for (const { e, existing } of insertChecks) {
  console.log(`挿入予定: ${e.date} ${e.category} ¥${e.amount} "${e.description}"(${e.store || "店舗未指定"}) — ${existing ? "既に同内容の行あり(スキップ)" : "新規"}`);
}

if (!apply) {
  console.log("dry-runのため更新はしていません。実際に反映するには --apply を付けて再実行してください。");
  process.exit(0);
}

db.exec("BEGIN");
try {
  for (const m of updateMatches) {
    doUpdate.run(m.u.newStore, m.u.newDesc, m.rows[0].id);
  }
  let inserted = 0;
  for (const { e, existing } of insertChecks) {
    if (existing) continue;
    doInsert.run(e.date, e.category, e.store, e.amount, e.description, e.source);
    inserted += 1;
  }
  db.exec("COMMIT");
  console.log(`更新${UPDATES.length}件、新規挿入${inserted}件を反映しました。`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("更新中にエラーが発生したため、すべて取り消しました:", err);
  process.exit(1);
}
