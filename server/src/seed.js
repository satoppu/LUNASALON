import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow, normalizeSubscriptionRow } from "./importRows.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const SEED_CSV_PATH = path.join(DATA_DIR, "luna_usage_2023-2026.csv");
const SUBSCRIPTIONS_CSV_PATH = path.join(DATA_DIR, "luna_subscriptions_2023-2026.csv");

function parseCsvFile(filePath) {
  const csvText = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.warn(`CSV parse warnings in ${path.basename(filePath)} (${parsed.errors.length}):`, parsed.errors.slice(0, 5));
  }
  return parsed.data;
}

// Incremental raw-export imports (server/src/importRawBookings.js /
// importRawSubscriptions.js) append to their own dated files here instead of
// the two files above, so each import's provenance stays visible and the
// original historical CSVs never need hand-editing.
function findIncrementalFiles(prefix) {
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".csv"))
    .sort()
    .map((f) => path.join(DATA_DIR, f));
}

function seed() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM transactions").get();
  if (existing.n > 0) {
    console.log(`transactions already has ${existing.n} rows — skipping seed (delete luna.db to re-seed).`);
    return;
  }

  const usageFiles = [SEED_CSV_PATH, ...findIncrementalFiles("luna_usage_") .filter((f) => f !== SEED_CSV_PATH)];
  const subscriptionFiles = [
    SUBSCRIPTIONS_CSV_PATH,
    ...findIncrementalFiles("luna_subscriptions_").filter((f) => f !== SUBSCRIPTIONS_CSV_PATH),
  ];

  const usageRows = usageFiles.flatMap((f) => parseCsvFile(f).map(normalizeImportRow).filter(Boolean));
  const subscriptionRows = subscriptionFiles.flatMap((f) =>
    parseCsvFile(f).map(normalizeSubscriptionRow).filter(Boolean)
  );
  const rows = [...usageRows, ...subscriptionRows];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id, booking_date, revenue_confirmed_date)
    VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id, @booking_date, @revenue_confirmed_date)
  `);
  db.exec("BEGIN");
  try {
    for (const r of rows) insert.run(r);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log(
    `Seeded ${usageRows.length} usage transactions from ${usageFiles.map((f) => path.basename(f)).join(", ")} and ${subscriptionRows.length} subscription transactions from ${subscriptionFiles.map((f) => path.basename(f)).join(", ")}.`
  );
}

seed();
