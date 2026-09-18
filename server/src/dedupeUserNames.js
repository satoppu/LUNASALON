// One-time (but safely re-runnable) cleanup for the historical bundled CSV
// (server/data/luna_usage_2023-2026.csv), which mixes 自社サイト and
// Instabase exports recording the same person's "顧客名"/"予約者名" two
// different ways — either just spaced differently (e.g. "高山薫" vs
// "高山 薫") or, for a few customers confirmed by the business, genuinely
// different spellings (userNameAliases.js: an abbreviated name, or a
// romanized name vs its kanji). That predates canonicalizeUserName
// (importHelpers.js), which only dedupes at raw-import time going forward —
// it can't retroactively fix rows already sitting in the table under two
// spellings. This runs two merge passes: first the explicit
// USER_NAME_ALIASES pairings, then automatic whitespace-stripped grouping
// for everything else, each group merging onto whichever spelling has the
// most rows (ties go to the no-space form).
//
// Usage: node src/dedupeUserNames.js [--dry-run]
import db from "./db.js";
import { USER_NAME_ALIASES } from "./userNameAliases.js";

const WHITESPACE = /[\s　]/g;

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
  const countFor = (name) =>
    db.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE user_name = ?`).get(name).n;

  let groupsMerged = 0;
  let rowsUpdated = 0;

  db.exec("BEGIN");
  try {
    // Pass 1: explicit business-confirmed aliases (userNameAliases.js).
    for (const { canonical, aliases } of USER_NAME_ALIASES) {
      const others = aliases.map((user_name) => ({ user_name, n: countFor(user_name) })).filter((o) => o.n > 0);
      if (others.length === 0) continue;
      groupsMerged++;
      rowsUpdated += mergeGroup(updateStmt, canonical, others, dryRun);
    }

    // Pass 2: automatic whitespace-only grouping for everything else.
    const names = db.prepare(`SELECT user_name, COUNT(*) AS n FROM transactions GROUP BY user_name`).all();
    const groups = new Map();
    for (const { user_name, n } of names) {
      const stripped = user_name.replace(WHITESPACE, "");
      if (!groups.has(stripped)) groups.set(stripped, []);
      groups.get(stripped).push({ user_name, n });
    }
    for (const variants of groups.values()) {
      if (variants.length <= 1) continue;
      const canonical = [...variants].sort((a, b) => {
        if (b.n !== a.n) return b.n - a.n;
        return a.user_name.length - b.user_name.length;
      })[0].user_name;
      const others = variants.filter((v) => v.user_name !== canonical);
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
