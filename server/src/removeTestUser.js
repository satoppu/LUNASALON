// CLI: one-time removal of a test/personal booking record. "藤田聡之" is the
// dashboard operator's own name, used to test bookings — not a real
// customer — so these rows should not appear anywhere in the dashboard.
//
// Usage: node src/removeTestUser.js [--dry-run]
import db from "./db.js";

const TARGET_USER = "藤田聡之";

function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rows = db.prepare(`SELECT id, date, store, channel, revenue FROM transactions WHERE user_name = ?`).all(TARGET_USER);
  console.log(`rows for "${TARGET_USER}": ${rows.length}`);

  if (dryRun) {
    console.log("[dry run] would delete:", JSON.stringify(rows, null, 1));
    return;
  }

  const deleteStmt = db.prepare(`DELETE FROM transactions WHERE user_name = ?`);
  db.exec("BEGIN");
  try {
    const info = deleteStmt.run(TARGET_USER);
    db.exec("COMMIT");
    console.log("deleted:", info.changes);
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

main();
