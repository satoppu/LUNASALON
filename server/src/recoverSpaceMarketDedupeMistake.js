// CLI: one-time recovery from running the *first* version of
// dedupeSpaceMarketLegacyRows.js, which had the keep/delete direction
// backwards — it deleted the 44 legacy (external_id IS NULL) スペースマーケット
// rows (which had the correct, more detailed hours/status data) and kept
// their less-accurate external_id-tagged duplicates.
//
// This restores the 44 deleted legacy rows from a snapshot taken before
// they were removed, then re-runs the (now-corrected) dedup logic to
// delete the external_id-tagged duplicates and keep the restored legacy
// rows — the outcome the corrected script was always meant to produce.
//
// Safe to run even if the legacy rows were never actually deleted (the
// dry-run step below will just report 0 missing and do nothing).
//
// Usage: node src/recoverSpaceMarketDedupeMistake.js [--dry-run]
import db from "./db.js";

const LEGACY_ROWS_SNAPSHOT = [{"date":"2024-10-03","store":"Bellezza","user_name":"熊澤佑太","revenue":1221,"hours_used":1,"start_hour":17,"weekday":"木","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-10-03","store":"Bellezza","user_name":"熊澤佑太","revenue":940,"hours_used":1,"start_hour":19,"weekday":"木","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-10-08","store":"Bellezza","user_name":"熊澤佑太","revenue":2350,"hours_used":2.25,"start_hour":17,"weekday":"火","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-10-26","store":"Bellezza","user_name":"加藤朋美","revenue":1045,"hours_used":1,"start_hour":8,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-14","store":"Forest","user_name":"加藤朋美","revenue":523,"hours_used":0,"start_hour":8,"weekday":"木","channel":"スペースマーケット","status":"キャンセル(返金あり)","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-22","store":"Forest","user_name":"加藤朋美","revenue":0,"hours_used":0,"start_hour":8,"weekday":"金","channel":"スペースマーケット","status":"キャンセル(顧客)","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-23","store":"Forest","user_name":"鈴木悠馬","revenue":1045,"hours_used":1,"start_hour":13,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-23","store":"Forest","user_name":"辺見有希","revenue":1567,"hours_used":1.5,"start_hour":15,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-27","store":"Bellezza","user_name":"菊池翔","revenue":1188,"hours_used":1,"start_hour":15,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-11-28","store":"Forest","user_name":"加藤朋美","revenue":0,"hours_used":0,"start_hour":8,"weekday":"木","channel":"スペースマーケット","status":"キャンセル(顧客)","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-12-05","store":"Bellezza","user_name":"石川妃優香","revenue":3465,"hours_used":3,"start_hour":15,"weekday":"木","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-12-15","store":"Bellezza","user_name":"フクオカクミコ","revenue":3465,"hours_used":3,"start_hour":14,"weekday":"日","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-12-21","store":"Forest","user_name":"佐藤千尋","revenue":1188,"hours_used":1,"start_hour":14,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-12-28","store":"Forest","user_name":"佐藤千尋","revenue":1188,"hours_used":1,"start_hour":13,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2024-12-30","store":"Forest","user_name":"佐藤千尋","revenue":3564,"hours_used":3,"start_hour":10,"weekday":"月","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-01-12","store":"Bellezza","user_name":"下山崇","revenue":5390,"hours_used":4,"start_hour":17,"weekday":"日","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-01-24","store":"Forest","user_name":"郷戸美江","revenue":3465,"hours_used":3,"start_hour":9,"weekday":"金","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-01-25","store":"Forest","user_name":"南山大","revenue":4015,"hours_used":3,"start_hour":18,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-01-26","store":"Bellezza","user_name":"宮入直","revenue":3223,"hours_used":2.5,"start_hour":18,"weekday":"日","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-01-27","store":"Forest","user_name":"竹本丈介","revenue":2376,"hours_used":2,"start_hour":12,"weekday":"月","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-02-01","store":"Forest","user_name":"橋本拓真","revenue":1485,"hours_used":1.25,"start_hour":18,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-03-14","store":"Bellezza","user_name":"浅原翼嵩","revenue":2673,"hours_used":2.25,"start_hour":13,"weekday":"金","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-04-04","store":"Forest","user_name":"飯塚真優","revenue":1320,"hours_used":1,"start_hour":18,"weekday":"金","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-05-31","store":"Forest","user_name":"星野真理","revenue":2640,"hours_used":2,"start_hour":15,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-08-12","store":"Bellezza","user_name":"下山崇","revenue":4279,"hours_used":3,"start_hour":10,"weekday":"火","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-08-13","store":"Forest","user_name":"木我友香","revenue":1320,"hours_used":1,"start_hour":18,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-08-19","store":"Forest","user_name":"中村竜海","revenue":1188,"hours_used":1,"start_hour":19,"weekday":"火","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-08-26","store":"Forest","user_name":"中村竜海","revenue":0,"hours_used":0,"start_hour":18,"weekday":"火","channel":"スペースマーケット","status":"キャンセル(顧客)","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-09-10","store":"Forest","user_name":"五十嵐健一","revenue":1188,"hours_used":1,"start_hour":18,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-09-17","store":"Bellezza","user_name":"田子智貴","revenue":3162,"hours_used":3,"start_hour":18,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-10-04","store":"Bellezza","user_name":"宮田果歩","revenue":1897,"hours_used":1.5,"start_hour":12,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-11-19","store":"Bellezza","user_name":"石川愛真","revenue":1980,"hours_used":1.5,"start_hour":16,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-12-03","store":"Forest","user_name":"内ケ島直希","revenue":1782,"hours_used":1.5,"start_hour":17,"weekday":"水","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-12-20","store":"Forest","user_name":"小島さき","revenue":1980,"hours_used":1.5,"start_hour":10,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2025-12-22","store":"Bellezza","user_name":"鈴木海妃","revenue":693,"hours_used":1,"start_hour":7,"weekday":"月","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-02-24","store":"Bellezza","user_name":"望月明子","revenue":2530,"hours_used":2,"start_hour":19,"weekday":"火","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-04-19","store":"Asteria","user_name":"仲田友乃","revenue":0,"hours_used":0,"start_hour":11,"weekday":"日","channel":"スペースマーケット","status":"キャンセル(顧客)","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-07-11","store":"Asteria","user_name":"永元芳幸","revenue":1210,"hours_used":1,"start_hour":10,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-07-17","store":"Asteria","user_name":"永元芳幸","revenue":4455,"hours_used":3.5,"start_hour":18,"weekday":"金","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-07-18","store":"Asteria","user_name":"須藤亜優","revenue":5142,"hours_used":4.25,"start_hour":13,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-07-19","store":"Asteria","user_name":"中村篤夫","revenue":2640,"hours_used":2,"start_hour":10,"weekday":"日","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-07-25","store":"Asteria","user_name":"熊澤佑太","revenue":2560,"hours_used":2.25,"start_hour":8,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-08-08","store":"Asteria","user_name":"山田佳郎","revenue":3850,"hours_used":3,"start_hour":9,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null},{"date":"2026-08-08","store":"Bellezza","user_name":"嶋田航平","revenue":2530,"hours_used":2,"start_hour":10,"weekday":"土","channel":"スペースマーケット","status":"利用済み","external_id":null,"booking_date":null,"revenue_confirmed_date":null,"booking_amount":null}];

function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Only restore rows that are actually missing (safe to re-run).
  const existsStmt = db.prepare(
    `SELECT 1 FROM transactions WHERE channel = 'スペースマーケット' AND external_id IS NULL AND date = ? AND user_name = ? AND revenue = ?`
  );
  const missing = LEGACY_ROWS_SNAPSHOT.filter((r) => !existsStmt.get(r.date, r.user_name, r.revenue));

  console.log(`legacy rows in snapshot: ${LEGACY_ROWS_SNAPSHOT.length}`);
  console.log(`missing (need restore): ${missing.length}`);

  if (dryRun) {
    console.log("[dry run] would restore:", JSON.stringify(missing, null, 1));
  } else if (missing.length > 0) {
    const insertStmt = db.prepare(`
      INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id, booking_date, revenue_confirmed_date, booking_amount)
      VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id, @booking_date, @revenue_confirmed_date, @booking_amount)
    `);
    db.exec("BEGIN");
    try {
      for (const row of missing) insertStmt.run(row);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    console.log("restored:", missing.length);
  }

  // Now remove the external_id-tagged duplicates (the corrected dedup
  // direction), same matching rule as dedupeSpaceMarketLegacyRows.js.
  const newRows = db
    .prepare(`SELECT id, date, store, user_name, revenue FROM transactions WHERE channel = 'スペースマーケット' AND external_id IS NOT NULL`)
    .all();
  const legacyRows = db
    .prepare(`SELECT id, date, store, user_name, revenue FROM transactions WHERE channel = 'スペースマーケット' AND external_id IS NULL`)
    .all();
  const legacyByDateName = new Map();
  for (const row of legacyRows) {
    const key = `${row.date}|${row.user_name}`;
    if (!legacyByDateName.has(key)) legacyByDateName.set(key, []);
    legacyByDateName.get(key).push(row);
  }

  const toDelete = new Map();
  const ambiguous = [];
  for (const n of newRows) {
    const candidates = legacyByDateName.get(`${n.date}|${n.user_name}`) || [];
    if (candidates.length === 0) continue;
    if (candidates.length === 1) {
      toDelete.set(n.id, n);
      continue;
    }
    const exact = candidates.find((c) => c.revenue === n.revenue);
    if (exact) toDelete.set(n.id, n);
    else ambiguous.push({ newRow: n, candidates });
  }

  console.log(`new-row duplicates to remove: ${toDelete.size}`);
  if (ambiguous.length > 0) {
    console.log(`ambiguous — left untouched: ${ambiguous.length}`);
    console.log(JSON.stringify(ambiguous, null, 1));
  }

  if (dryRun) {
    console.log("[dry run] would delete:", JSON.stringify([...toDelete.values()], null, 1));
    return;
  }

  const deleteStmt = db.prepare(`DELETE FROM transactions WHERE id = ?`);
  let deleted = 0;
  db.exec("BEGIN");
  try {
    for (const id of toDelete.keys()) {
      deleteStmt.run(id);
      deleted++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log("deleted:", deleted);
}

main();
