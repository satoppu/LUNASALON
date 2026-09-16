// CLI wrapper around rawImportMappers.mapRawSubscriptionRow: reads a raw
// 定期クーポン purchase export file, inserts new rows into server/luna.db, and
// appends them to a dated CSV under server/data for reproducibility. See
// rawImportMappers.js for the column shape and store-linking rule — the same
// mapper backs the web /api/import upload path (importService.js), so
// uploading this file through the dashboard's own "CSVインポート" button
// works too.
//
// Run this *after* importing any booking data covering the same period, so
// store-resolution has the fullest possible history to work from.
//
// Every row carries 支払いID as external_id, so re-running this on an export
// that overlaps a *previous run of this script* is safe (INSERT OR IGNORE on
// that unique key). It is NOT safe against re-covering ground already in the
// bundled historical subscriptions CSV (which has no external_id), so this
// only imports rows dated after the latest 定期クーポン purchase already in
// transactions — pass --since=YYYY-MM-DD to override.
//
// Usage: node src/importRawSubscriptions.js <path-to-export.csv> [--since=YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { SUBSCRIPTION_STATUS } from "./config.js";
import { mapRawSubscriptionRow } from "./rawImportMappers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, 0, NULL, @weekday, @channel, @status, @external_id)
`);

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  if (!inputPath) {
    console.error("Usage: node src/importRawSubscriptions.js <path-to-export.csv> [--since=YYYY-MM-DD]");
    process.exit(1);
  }

  const existingMaxDate = db.prepare("SELECT MAX(date) AS d FROM transactions WHERE status = ?").get(SUBSCRIPTION_STATUS).d;
  const since = sinceArg || existingMaxDate || "0000-00-00";
  console.log(`Only importing rows dated after ${since}${sinceArg ? " (--since)" : " (latest existing subscription date)"}.`);

  const csvText = fs.readFileSync(inputPath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const outRows = [];
  let inserted = 0;
  let ignoredDuplicate = 0;
  let skippedAlreadyCovered = 0;
  let unresolvedOrBad = 0;

  db.exec("BEGIN");
  try {
    for (const raw of parsed.data) {
      const row = mapRawSubscriptionRow(raw);
      if (!row) {
        unresolvedOrBad++;
        continue;
      }
      if (row.date <= since) {
        skippedAlreadyCovered++;
        continue;
      }

      const result = insertStmt.run(row);
      if (result.changes > 0) {
        inserted++;
        outRows.push(row);
      } else {
        ignoredDuplicate++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log({ inserted, ignoredDuplicate, skippedAlreadyCovered, unresolvedOrBad });
  if (unresolvedOrBad > 0) {
    console.warn(
      "Some rows had an unparseable date/amount, or the customer has no usage history yet to resolve a store from — not imported."
    );
  }

  if (outRows.length > 0) {
    const outPath = path.join(DATA_DIR, `luna_subscriptions_${outRows[0].date.slice(0, 7)}_raw_imports.csv`);
    const header = "date,store,user,revenue,weekday,external_id";
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    const lines = outRows.map((r) => [r.date, r.store, esc(r.user_name), r.revenue, r.weekday, r.external_id].join(","));
    const isNew = !fs.existsSync(outPath);
    fs.appendFileSync(outPath, (isNew ? header + "\n" : "") + lines.join("\n") + "\n", "utf-8");
    console.log(`Appended ${outRows.length} rows to ${path.basename(outPath)}`);
  }
  console.warn(
    "Rows are already live in server/luna.db. The generated CSV just keeps the import reproducible for a future from-scratch reseed."
  );
}

main();
