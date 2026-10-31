// One-time (but safely re-runnable) cleanup for rows already sitting in the
// table under an inconsistent spelling of the same real person's name —
// either just spaced differently (e.g. "高山薫" vs "高山 薫") or, for a few
// customers confirmed by the business, a genuinely different spelling
// (userNameAliases.js: an abbreviated name, or a romanized name vs its
// kanji). canonicalizeUserName (importHelpers.js) applies this same
// normalization at raw-import time going forward, but can't retroactively
// fix rows imported before it existed, or before a given alias was added to
// userNameAliases.js — this re-derives every existing row's canonical name
// with the current rules and merges any group that collapses onto one.
//
// Usage: node src/dedupeUserNames.js [--dry-run]
import db from "./db.js";
import { canonicalizeUserName } from "./importHelpers.js";

function mergeGroup(updateStmt, canonical, others, dryRun) {
  if (others.length === 0) return 0;
  console.log(`${canonical}  <-  ${others.map((o) => `${JSON.stringify(o.user_name)}(${o.n})`).join(", ")}`);
  if (!dryRun) {
    for (const o of others) updateStmt.run(canonical, o.user_name);
  }
  return others.reduce((sum, o) => sum + o.n, 0);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const updateStmt = db.prepare(`UPDATE transactions SET user_name = ? WHERE user_name = ?`);

  const names = db.prepare(`SELECT user_name, COUNT(*) AS n FROM transactions GROUP BY user_name`).all();
  const groups = new Map();
  for (const { user_name, n } of names) {
    const canonical = canonicalizeUserName(user_name);
    if (!groups.has(canonical)) groups.set(canonical, []);
    groups.get(canonical).push({ user_name, n });
  }

  let groupsMerged = 0;
  let rowsUpdated = 0;

  db.exec("BEGIN");
  try {
    for (const [canonical, variants] of groups) {
      const others = variants.filter((v) => v.user_name !== canonical);
      if (others.length === 0) continue;
      groupsMerged++;
      rowsUpdated += mergeGroup(updateStmt, canonical, others, dryRun);
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
