import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow, normalizeSubscriptionRow } from "./importRows.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_CSV_PATH = path.join(__dirname, "..", "data", "luna_usage_2023-2026.csv");
const SUBSCRIPTIONS_CSV_PATH = path.join(__dirname, "..", "data", "luna_subscriptions_2023-2026.csv");

function parseCsvFile(filePath) {
  const csvText = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.warn(`CSV parse warnings in ${path.basename(filePath)} (${parsed.errors.length}):`, parsed.errors.slice(0, 5));
  }
  return parsed.data;
}

function seed() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM transactions").get();
  if (existing.n > 0) {
    console.log(`transactions already has ${existing.n} rows — skipping seed (delete luna.db to re-seed).`);
    return;
  }

  const usageRows = parseCsvFile(SEED_CSV_PATH).map(normalizeImportRow).filter(Boolean);
  const subscriptionRows = parseCsvFile(SUBSCRIPTIONS_CSV_PATH).map(normalizeSubscriptionRow).filter(Boolean);
  const rows = [...usageRows, ...subscriptionRows];

  const insert = db.prepare(`
    INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status)
    VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status)
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
    `Seeded ${usageRows.length} usage transactions from ${path.basename(SEED_CSV_PATH)} and ${subscriptionRows.length} subscription transactions from ${path.basename(SUBSCRIPTIONS_CSV_PATH)}.`
  );
}

seed();
