// CLI: one-time cleanup for a real double-counting bug — the bundled
// historical CSV that originally seeded this database already contained a
// small set of スペースマーケット bookings (imported with no external_id,
// before that tracking existed). Both the later xlsx historical bulk-load
// and the recurring monthly CSV cover an overlapping date range, so those
// same real-world bookings got inserted a second time as new rows (this
// time correctly carrying external_id/予約ID) — double-counting their
// revenue/hours.
//
// The legacy (external_id IS NULL) rows turned out to be the more reliable
// side: they already carry real hours_used/start_hour, and distinguish
// キャンセル(返金あり) (partial refund, fee retained) from キャンセル(顧客)
// (full refund) — detail the newer imports can't reconstruct from the raw
// exports. So this keeps the legacy row and deletes the newer duplicate,
// matched on date + user_name (disambiguated by revenue when a date+name
// pair has more than one legacy row, e.g. the same guest booking twice in
// a day). New rows with no legacy match are left alone — they're genuinely
// new bookings, not duplicates.
//
// Usage: node src/dedupeSpaceMarketLegacyRows.js [--dry-run]
import db from "./db.js";

function main() {
  const dryRun = process.argv.includes("--dry-run");

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

  const toDelete = new Map(); // id -> row (the NEW row to remove)
  const ambiguous = [];
  for (const n of newRows) {
    const candidates = legacyByDateName.get(`${n.date}|${n.user_name}`) || [];
    if (candidates.length === 0) continue;
    if (candidates.length === 1) {
      toDelete.set(n.id, n);
      continue;
    }
    const exact = candidates.find((c) => c.revenue === n.revenue);
    if (exact) {
      toDelete.set(n.id, n);
    } else {
      ambiguous.push({ newRow: n, candidates });
    }
  }

  console.log(`legacy (external_id IS NULL) スペースマーケット rows: ${legacyRows.length}`);
  console.log(`newly imported rows: ${newRows.length}`);
  console.log(`new-row duplicates identified: ${toDelete.size}`);
  if (ambiguous.length > 0) {
    console.log(`ambiguous — left untouched, review manually: ${ambiguous.length}`);
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
