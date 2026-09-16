import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow } from "./importRows.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_CSV_PATH = path.join(__dirname, "..", "data", "luna_usage_2023-2026.csv");

function seed() {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM transactions").get();
  if (existing.n > 0) {
    console.log(`transactions already has ${existing.n} rows — skipping seed (delete luna.db to re-seed).`);
    return;
  }

  const csvText = fs.readFileSync(SEED_CSV_PATH, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    console.warn(`CSV parse warnings (${parsed.errors.length}):`, parsed.errors.slice(0, 5));
  }

  const rows = parsed.data.map(normalizeImportRow).filter(Boolean);

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

  console.log(`Seeded ${rows.length} transactions from ${path.basename(SEED_CSV_PATH)}.`);
}

seed();
