// CLI wrapper around rawImportMappers.mapRawBookingRow: reads a raw booking
// export file, inserts/updates rows in server/luna.db, and appends newly
// inserted rows to a dated CSV under server/data for reproducibility. See
// rawImportMappers.js for the column shape and status/revenue business rules
// — the same mapper backs the web /api/import upload path
// (importService.js), so uploading this file through the dashboard's own
// "CSVインポート" button works too.
//
// Every row carries 決済ID as external_id. A row whose external_id already
// exists gets its fields updated in place rather than ignored — this is how
// a booking transitions from 状態="未確定" (PENDING_STATUS, "利用前") to
// "利用済み" (or a cancellation) across two runs of this script against
// later exports of the same booking, without creating a duplicate row. This
// is NOT safe against re-covering ground already in the bundled historical
// CSV, though: that data has no external_id (it predates this import path),
// so the same real booking would insert again as a distinct row and
// double-count revenue/hours. To guard against that, this only imports rows
// whose usage date is after the latest date among historical
// (external_id-less) rows — pass --since=YYYY-MM-DD to override (e.g. for a
// first run against an export whose period doesn't butt up against existing
// data).
//
// Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { mapRawBookingRow } from "./rawImportMappers.js";
import { PENDING_STATUS } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const upsertStmt = db.prepare(`
  INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id, booking_date)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id, @booking_date)
  ON CONFLICT(external_id) DO UPDATE SET
    date = excluded.date,
    store = excluded.store,
    user_name = excluded.user_name,
    revenue = excluded.revenue,
    hours_used = excluded.hours_used,
    start_hour = excluded.start_hour,
    weekday = excluded.weekday,
    channel = excluded.channel,
    status = excluded.status,
    booking_date = excluded.booking_date
  WHERE external_id IS NOT NULL
`);
const existsStmt = db.prepare(`SELECT 1 FROM transactions WHERE external_id = ?`);

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  if (!inputPath) {
    console.error("Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]");
    process.exit(1);
  }

  const existingMaxDate = db.prepare("SELECT MAX(date) AS d FROM transactions WHERE external_id IS NULL").get().d;
  const since = sinceArg || existingMaxDate;
  console.log(`Only importing rows with usage date after ${since}${sinceArg ? " (--since)" : " (latest historical date)"}.`);

  const csvText = fs.readFileSync(inputPath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const outRows = [];
  let inserted = 0;
  let updated = 0;
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;

  db.exec("BEGIN");
  try {
    for (const raw of parsed.data) {
      const row = mapRawBookingRow(raw);
      if (!row) {
        skippedUnparseable++;
        continue;
      }
      if (row.date <= since && row.status !== PENDING_STATUS) {
        skippedAlreadyCovered++;
        continue;
      }

      const alreadyExists = row.external_id ? !!existsStmt.get(row.external_id) : false;
      upsertStmt.run(row);
      if (alreadyExists) {
        updated++;
      } else {
        inserted++;
        outRows.push(row);
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log({ inserted, updated, skippedUnparseable, skippedAlreadyCovered });

  if (outRows.length > 0) {
    const outPath = path.join(DATA_DIR, `luna_usage_${outRows[0].date.slice(0, 7)}_raw_imports.csv`);
    const header = "date,store,user,revenue,hoursUsed,hour,weekday,channel,status,external_id,booking_date";
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    const lines = outRows.map((r) =>
      [r.date, r.store, esc(r.user_name), r.revenue, r.hours_used, r.start_hour, r.weekday, r.channel, r.status, r.external_id, r.booking_date].join(
        ","
      )
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
