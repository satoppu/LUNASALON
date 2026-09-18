// One-time (but safely re-runnable) cleanup for the historical bundled CSV
// (server/data/luna_usage_2023-2026.csv), which mixes 自社サイト and
// Instabase exports whose "顧客名"/"予約者名" columns space the same
// person's name differently (e.g. "高山薫" vs "高山 薫"). That predates
// canonicalizeUserName (importHelpers.js), which only dedupes at raw-import
// time going forward — it can't retroactively fix rows already sitting in
// the table under two spellings. This walks every existing user_name,
// groups them by whitespace-stripped form, and merges each group onto
// whichever spelling has the most rows (ties go to the no-space form).
//
// Usage: node src/dedupeUserNames.js [--dry-run]
import db from "./db.js";

const WHITESPACE = /[\s　]/g;

function main() {
  const dryRun = process.argv.includes("--dry-run");

  const names = db
    .prepare(`SELECT user_name, COUNT(*) AS n FROM transactions GROUP BY user_name`)
    .all();

  const groups = new Map();
  for (const { user_name, n } of names) {
    const stripped = user_name.replace(WHITESPACE, "");
    if (!groups.has(stripped)) groups.set(stripped, []);
    groups.get(stripped).push({ user_name, n });
  }

  const updateStmt = db.prepare(`UPDATE transactions SET user_name = ? WHERE user_name = ?`);
  let groupsMerged = 0;
  let rowsUpdated = 0;

  db.exec("BEGIN");
  try {
    for (const variants of groups.values()) {
      if (variants.length <= 1) continue;
      const canonical = [...variants].sort((a, b) => {
        if (b.n !== a.n) return b.n - a.n;
        return a.user_name.length - b.user_name.length;
      })[0].user_name;

      const others = variants.filter((v) => v.user_name !== canonical);
      console.log(`${canonical}  <-  ${others.map((o) => `${JSON.stringify(o.user_name)}(${o.n})`).join(", ")}`);
      groupsMerged++;
      if (!dryRun) {
        for (const o of others) {
          updateStmt.run(canonical, o.user_name);
          rowsUpdated += o.n;
        }
      } else {
        rowsUpdated += others.reduce((sum, o) => sum + o.n, 0);
      }
    }
    if (dryRun) {
      db.exec("ROLLBACK");
    } else {
      db.exec("COMMIT");
    }
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log({ dryRun, groupsMerged, rowsUpdated });
}

main();
