// 一回限りの本番データ移行スクリプト。2026年分の初期経費データ
// (src/initialExpenses.js)に加えた店舗リンク・説明文の修正
// (京葉ガス/水道代(RTK)のB/F振り分け、東京電力のAsteria紐付け、
// 楽天モバイル等の説明文への用途注記など)を、既にseed済みの本番DBの
// 該当行にも反映するためのもの。
//
// 各行は date/category/amount/source/description(変更前)/store IS NULL の
// 組み合わせで一意に特定できることを事前に確認済み(initialExpenses.jsの
// 総額・件数はこの移行の前後で完全一致することも確認済み)。念のため、
// 全78件それぞれが「変更前の内容の行がちょうど1件だけ存在する」ことを
// 先に確認してから初めて更新を実行し、1件でも一致しない/複数一致するもの
// があれば何も書き換えずに中断する(部分適用はしない)。
//
// 使い方(本番サーバーのserver/ディレクトリで):
//   node scripts/migrate-2026-expense-store-links.js          # 確認のみ(dry-run)
//   node scripts/migrate-2026-expense-store-links.js --apply  # 実際に更新
import db from "../src/db.js";

const DIFFS = [
  { date: "2026-01-14", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-01-14", category: "水道光熱費", amount: 1211, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-01-27", category: "通信費", amount: 5574, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-02-10", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-02-10", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-02-27", category: "通信費", amount: 5572, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-02-28", category: "水道光熱費", amount: 4389, source: "bank", oldDesc: "水道代(RTK)", newStore: "Bellezza", newDesc: "水道代(RTK)" },
  { date: "2026-02-28", category: "水道光熱費", amount: 4622, source: "bank", oldDesc: "水道代(RTK)", newStore: "Forest", newDesc: "水道代(RTK)" },
  { date: "2026-03-10", category: "水道光熱費", amount: 1153, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-03-10", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-03-27", category: "通信費", amount: 4472, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-04-09", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-04-09", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-04-15", category: "水道光熱費", amount: 2585, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-04-27", category: "通信費", amount: 6660, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-05-02", category: "水道光熱費", amount: 4272, source: "bank", oldDesc: "水道代(RTK)", newStore: "Bellezza", newDesc: "水道代(RTK)" },
  { date: "2026-05-02", category: "水道光熱費", amount: 4389, source: "bank", oldDesc: "水道代(RTK)", newStore: "Forest", newDesc: "水道代(RTK)" },
  { date: "2026-05-14", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-05-14", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-05-18", category: "水道光熱費", amount: 1846, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-05-27", category: "通信費", amount: 6653, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-06-04", category: "水道光熱費", amount: 4587, source: "bank", oldDesc: "水道代(RTK)", newStore: "Bellezza", newDesc: "水道代(RTK)" },
  { date: "2026-06-09", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-06-09", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-06-15", category: "水道光熱費", amount: 1903, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-06-29", category: "通信費", amount: 6653, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-07-09", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-07-09", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-07-09", category: "家賃", amount: 10000, source: "bank", oldDesc: "カーサ(更新関連費用)", newStore: "Bellezza", newDesc: "カーサ(更新関連費用)" },
  { date: "2026-07-14", category: "水道光熱費", amount: 4389, source: "bank", oldDesc: "水道代(RTK)", newStore: "Bellezza", newDesc: "水道代(RTK)" },
  { date: "2026-07-14", category: "水道光熱費", amount: 4272, source: "bank", oldDesc: "水道代(RTK)", newStore: "Forest", newDesc: "水道代(RTK)" },
  { date: "2026-07-15", category: "水道光熱費", amount: 2015, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-07-27", category: "通信費", amount: 7753, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-08-12", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-08-12", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-08-17", category: "水道光熱費", amount: 2945, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-08-26", category: "保険料", amount: 11400, source: "bank", oldDesc: "アイオイニツセイドウワ", newStore: "Bellezza", newDesc: "アイオイニツセイドウワ(更新)" },
  { date: "2026-08-27", category: "通信費", amount: 8853, source: "bank", oldDesc: "楽天モバイル", newStore: null, newDesc: "楽天モバイル(Wifi)" },
  { date: "2026-09-03", category: "水道光熱費", amount: 1544, source: "bank", oldDesc: "水道代(RTK)", newStore: "Bellezza", newDesc: "水道代(RTK)" },
  { date: "2026-09-03", category: "水道光熱費", amount: 1777, source: "bank", oldDesc: "水道代(RTK)", newStore: "Forest", newDesc: "水道代(RTK)" },
  { date: "2026-09-09", category: "水道光熱費", amount: 1022, source: "bank", oldDesc: "京葉ガス", newStore: "Bellezza", newDesc: "京葉ガス" },
  { date: "2026-09-09", category: "水道光熱費", amount: 1154, source: "bank", oldDesc: "京葉ガス", newStore: "Forest", newDesc: "京葉ガス" },
  { date: "2026-09-14", category: "水道光熱費", amount: 2509, source: "bank", oldDesc: "東京電力", newStore: "Asteria", newDesc: "東京電力" },
  { date: "2026-01-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-01-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-01-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-02-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-02-06", category: "通信費", amount: 9873, source: "card_rakuten", oldDesc: "お名前.comサーバー", newStore: null, newDesc: "お名前.comサーバー(HP)" },
  { date: "2026-02-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-02-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-03-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-03-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-03-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-04-27", category: "水道光熱費", amount: 2962, source: "card_rakuten", oldDesc: "ジャパンデンリョク", newStore: "Bellezza", newDesc: "ジャパンデンリョク" },
  { date: "2026-04-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-04-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-04-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-05-30", category: "水道光熱費", amount: 4414, source: "card_rakuten", oldDesc: "ジャパンデンリョク", newStore: "Bellezza", newDesc: "ジャパンデンリョク" },
  { date: "2026-05-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-05-09", category: "通信費", amount: 5274, source: "card_rakuten", oldDesc: "お名前.comサーバー", newStore: null, newDesc: "お名前.comサーバー(HP)" },
  { date: "2026-05-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-05-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-06-27", category: "水道光熱費", amount: 5271, source: "card_rakuten", oldDesc: "ジャパンデンリョク", newStore: "Bellezza", newDesc: "ジャパンデンリョク" },
  { date: "2026-06-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-06-08", category: "通信費", amount: 2637, source: "card_rakuten", oldDesc: "お名前.comサーバー", newStore: null, newDesc: "お名前.comサーバー(HP)" },
  { date: "2026-06-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-06-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-07-28", category: "水道光熱費", amount: 4405, source: "card_rakuten", oldDesc: "ジャパンデンリョク", newStore: "Bellezza", newDesc: "ジャパンデンリョク" },
  { date: "2026-07-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-07-10", category: "通信費", amount: 1364, source: "card_rakuten", oldDesc: "お名前.comドメイン", newStore: null, newDesc: "お名前.comドメイン(HP)" },
  { date: "2026-07-08", category: "通信費", amount: 2637, source: "card_rakuten", oldDesc: "お名前.comサーバー", newStore: null, newDesc: "お名前.comサーバー(HP)" },
  { date: "2026-07-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
  { date: "2026-07-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-08-29", category: "水道光熱費", amount: 6014, source: "card_rakuten", oldDesc: "ジャパンデンリョク", newStore: "Bellezza", newDesc: "ジャパンデンリョク" },
  { date: "2026-08-24", category: "システム利用料", amount: 980, source: "card_rakuten", oldDesc: "ﾖﾔｸﾙ", newStore: null, newDesc: "ヨヤクル(予約サイト)" },
  { date: "2026-08-07", category: "通信費", amount: 12510, source: "card_rakuten", oldDesc: "お名前.comサーバー", newStore: null, newDesc: "お名前.comサーバー(HP)" },
  { date: "2026-08-01", category: "通信費", amount: 5500, source: "card_rakuten", oldDesc: "LINE公式", newStore: null, newDesc: "LINE公式(LINE予約)" },
  { date: "2026-08-01", category: "通信費", amount: 550, source: "card_rakuten", oldDesc: "ｻﾌﾞﾗｲﾝ", newStore: null, newDesc: "サブライン(mj-japanの電話)" },
];

const apply = process.argv.includes("--apply");

const findStmt = db.prepare(
  `SELECT id FROM expenses WHERE date = ? AND category = ? AND amount = ? AND source = ? AND description = ? AND store IS NULL`
);
const updateStmt = db.prepare(`UPDATE expenses SET store = ?, description = ? WHERE id = ?`);

const matches = DIFFS.map((d) => {
  const rows = findStmt.all(d.date, d.category, d.amount, d.source, d.oldDesc);
  return { diff: d, rows };
});

const bad = matches.filter((m) => m.rows.length !== 1);
if (bad.length > 0) {
  console.error(`中断: ${bad.length}件が「変更前の内容の行がちょうど1件」に該当しませんでした(0件または複数件)。`);
  for (const m of bad) {
    console.error(`  [${m.rows.length}件一致] ${m.diff.date} ${m.diff.category} ¥${m.diff.amount} "${m.diff.oldDesc}"`);
  }
  console.error("何も更新していません。データが既に想定と異なる可能性があるため、内容を確認してください。");
  process.exit(1);
}

console.log(`${DIFFS.length}件すべて、変更前の内容と一致する行がちょうど1件ずつ見つかりました。`);

if (!apply) {
  console.log("dry-runのため更新はしていません。実際に反映するには --apply を付けて再実行してください。");
  process.exit(0);
}

db.exec("BEGIN");
try {
  for (const m of matches) {
    updateStmt.run(m.diff.newStore, m.diff.newDesc, m.rows[0].id);
  }
  db.exec("COMMIT");
  console.log(`${DIFFS.length}件を更新しました。`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("更新中にエラーが発生したため、すべて取り消しました:", err);
  process.exit(1);
}
