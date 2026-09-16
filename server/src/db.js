import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { DEFAULT_STORES, DEFAULT_OPERATING_HOURS_PER_DAY } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.LUNA_DB_PATH || path.join(__dirname, "..", "luna.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    store TEXT NOT NULL,
    user_name TEXT NOT NULL,
    revenue INTEGER NOT NULL DEFAULT 0,
    hours_used REAL NOT NULL DEFAULT 0,
    start_hour INTEGER,
    weekday TEXT,
    channel TEXT NOT NULL DEFAULT '自社サイト',
    status TEXT NOT NULL DEFAULT '利用済み',
    external_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// booking_date (when the reservation was made, vs. `date` which is when the
// room is/was used) predates neither the historical CSV nor the simple
// template, so it's added as a migration rather than the CREATE TABLE above —
// existing rows just keep it NULL.
const hasBookingDate = db
  .prepare(`SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'booking_date'`)
  .get();
if (!hasBookingDate) {
  db.exec(`ALTER TABLE transactions ADD COLUMN booking_date TEXT;`);
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store, date);`);
// external_id (決済ID/支払いID from the reservation platform) lets raw-export
// imports be re-run safely — SQLite's UNIQUE index treats each NULL as
// distinct, so historical rows without one never collide.
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id ON transactions(external_id);`);

db.exec(`
  CREATE TABLE IF NOT EXISTS store_settings (
    store TEXT PRIMARY KEY,
    area TEXT,
    color TEXT,
    open_date TEXT,
    operating_hours_per_day REAL NOT NULL DEFAULT ${DEFAULT_OPERATING_HOURS_PER_DAY},
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

const seedStoreStmt = db.prepare(`
  INSERT INTO store_settings (store, area, color, operating_hours_per_day, sort_order)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(store) DO NOTHING;
`);
for (const s of DEFAULT_STORES) {
  seedStoreStmt.run(s.store, s.area, s.color, DEFAULT_OPERATING_HOURS_PER_DAY, s.sortOrder);
}

// Color isn't user-editable (店舗設定 only exposes open date/hours), so it's
// safe to keep every default store's color in sync with DEFAULT_STORES on
// every startup rather than only at first seed — otherwise a palette change
// here would never reach a database that was seeded before it.
const syncStoreColorStmt = db.prepare(`UPDATE store_settings SET color = ? WHERE store = ?`);
for (const s of DEFAULT_STORES) {
  syncStoreColorStmt.run(s.color, s.store);
}

export default db;
