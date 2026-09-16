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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_store ON transactions(store);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_store_date ON transactions(store, date);`);

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

export default db;
