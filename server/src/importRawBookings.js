// CLI wrapper around rawImportMappers.mapRawBookingRow: reads a raw booking
// export file, inserts new rows into server/luna.db, and appends them to a
// dated CSV under server/data for reproducibility. See rawImportMappers.js
// for the column shape and status/revenue business rules — the same mapper
// backs the web /api/import upload path (importService.js), so uploading
// this file through the dashboard's own "CSVインポート" button works too.
//
// Every row carries 決済ID as external_id, so re-running this on an export
// that overlaps a *previous run of this script* is safe (INSERT OR IGNORE on
// that unique key). It is NOT safe against re-covering ground already in the
// bundled historical CSV, though: that data has no external_id (it predates
// this import path), so the same real booking would insert again as a
// distinct row and double-count revenue/hours. To guard against that, this
// only imports rows whose usage date is after the latest date already in
// transactions — pass --since=YYYY-MM-DD to override (e.g. for a first run
// against an export whose period doesn't butt up against existing data).
//
// Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { mapRawBookingRow } from "./rawImportMappers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id)
`);

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  if (!inputPath) {
    console.error("Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]");
    process.exit(1);
  }

  const existingMaxDate = db.prepare("SELECT MAX(date) AS d FROM transactions").get().d;
  const since = sinceArg || existingMaxDate;
  console.log(`Only importing rows with usage date after ${since}${sinceArg ? " (--since)" : " (latest existing date)"}.`);

  const csvText = fs.readFileSync(inputPath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const outRows = [];
  let inserted = 0;
  let ignoredDuplicate = 0;
  let skippedPending = 0;
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;

  db.exec("BEGIN");
  try {
    for (const raw of parsed.data) {
      if (raw["状態"] === "未確定") {
        skippedPending++;
        continue;
      }

      const row = mapRawBookingRow(raw);
      if (!row) {
        skippedUnparseable++;
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

  console.log({ inserted, ignoredDuplicate, skippedPending, skippedUnparseable, skippedAlreadyCovered });

  if (outRows.length > 0) {
    const outPath = path.join(DATA_DIR, `luna_usage_${outRows[0].date.slice(0, 7)}_raw_imports.csv`);
    const header = "date,store,user,revenue,hoursUsed,hour,weekday,channel,status,external_id";
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    const lines = outRows.map((r) =>
      [r.date, r.store, esc(r.user_name), r.revenue, r.hours_used, r.start_hour, r.weekday, r.channel, r.status, r.external_id].join(",")
    );
    const isNew = !fs.existsSync(outPath);
    fs.appendFileSync(outPath, (isNew ? header + "\n" : "") + lines.join("\n") + "\n", "utf-8");
    console.log(`Appended ${outRows.length} rows to ${path.basename(outPath)}`);
  }
  console.warn(
    "Rows are already live in server/luna.db. The generated CSV just keeps the import reproducible for a future from-scratch reseed."
  );
}

main();
