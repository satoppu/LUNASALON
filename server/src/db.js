import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { DEFAULT_STORES, DEFAULT_OPERATING_HOURS_PER_DAY } from "./config.js";
import { INITIAL_CABINETS, INITIAL_COUPONS } from "./initialCabinetsAndCoupons.js";
import { INITIAL_BUSINESS_EVENTS } from "./initialBusinessEvents.js";

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
// revenue_confirmed_date (自社サイトの「売り上げ確定日時」) — for a cancelled
// row this is when the cancellation was actually processed, which can be a
// different month than booking_date. Lets 決済日ベース revenue book a
// cancellation's impact in the month it happened rather than retroactively
// inside the original booking month.
const hasRevenueConfirmedDate = db
  .prepare(`SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'revenue_confirmed_date'`)
  .get();
if (!hasRevenueConfirmedDate) {
  db.exec(`ALTER TABLE transactions ADD COLUMN revenue_confirmed_date TEXT;`);
}
// booking_amount (自社サイトの決済元金+割引金額) — the amount actually charged
// at booking time, captured regardless of what the row's status later became.
// For a completed booking this equals `revenue`; for a cancelled one it lets
// 決済日ベース revenue book the original amount in booking_date's month and
// the cancellation's loss separately in revenue_confirmed_date's month.
const hasBookingAmount = db
  .prepare(`SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'booking_amount'`)
  .get();
if (!hasBookingAmount) {
  db.exec(`ALTER TABLE transactions ADD COLUMN booking_amount INTEGER;`);
}
// start_minute — the minute component of a booking's start time (start_hour
// only ever held the hour). Added as a migration since existing rows predate
// it; they just keep it NULL and display as hour-only.
const hasStartMinute = db
  .prepare(`SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'start_minute'`)
  .get();
if (!hasStartMinute) {
  db.exec(`ALTER TABLE transactions ADD COLUMN start_minute INTEGER;`);
}
// cancelled_date — the date the daily自動取り込み first observed this row's
// status switch to a cancellation status. The source export has no such
// field, so this is filled in at import time (see importService.js) rather
// than read from the file; existing rows predate it and start out NULL.
const hasCancelledDate = db
  .prepare(`SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'cancelled_date'`)
  .get();
if (!hasCancelledDate) {
  db.exec(`ALTER TABLE transactions ADD COLUMN cancelled_date TEXT;`);
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

// Free-text notes ("振り返り"/"やる事") kept per dashboard page (サマリー,
// 売上分析, etc.), so a page's history of decisions/follow-ups lives next to
// the data it's about instead of in a separate document.
db.exec(`
  CREATE TABLE IF NOT EXISTS page_notes (
    page_key TEXT PRIMARY KEY,
    reflection TEXT NOT NULL DEFAULT '',
    todo TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// キャビネット利用(店舗ごとの物理キャビネット番号/位置と、現在の利用者)。
// user_nameはNULL可(「空き」)。同じ店舗内でslot_labelは重複しない。
db.exec(`
  CREATE TABLE IF NOT EXISTS cabinet_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL,
    slot_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    user_name TEXT
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cabinet_assignments_store_slot ON cabinet_assignments(store, slot_label);`);

const seedCabinetStmt = db.prepare(`
  INSERT INTO cabinet_assignments (store, slot_label, sort_order, user_name)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(store, slot_label) DO NOTHING;
`);
for (const c of INITIAL_CABINETS) {
  seedCabinetStmt.run(c.store, c.slot, c.sortOrder, c.user);
}

// 定額クーポンのID(顧客ごとに割り当てるID)。user_nameはNULL可(未割当)。
db.exec(`
  CREATE TABLE IF NOT EXISTS coupon_ids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    user_name TEXT
  );
`);
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_ids_coupon_id ON coupon_ids(coupon_id);`);

const seedCouponStmt = db.prepare(`
  INSERT INTO coupon_ids (coupon_id, sort_order, user_name)
  VALUES (?, ?, ?)
  ON CONFLICT(coupon_id) DO NOTHING;
`);
for (const c of INITIAL_COUPONS) {
  seedCouponStmt.run(c.id, c.sortOrder, c.user);
}

// 出来事メモ(工事休業・新店オープンなど、集計だけでは分からない背景情報)。
// storesはカンマ区切りの店舗名、NULL/空は全店舗対象。自然な一意キーが無い
// ため、cabinet_assignments/coupon_idsと違いON CONFLICTでは防げない —
// テーブルが空のときだけ初回シードする(以後はDBが正)。
db.exec(`
  CREATE TABLE IF NOT EXISTS business_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    stores TEXT,
    note TEXT NOT NULL
  );
`);
const businessEventsCount = db.prepare(`SELECT COUNT(*) AS c FROM business_events`).get().c;
if (businessEventsCount === 0) {
  const seedEventStmt = db.prepare(
    `INSERT INTO business_events (start_date, end_date, stores, note) VALUES (?, ?, ?, ?)`
  );
  for (const e of INITIAL_BUSINESS_EVENTS) {
    seedEventStmt.run(e.startDate, e.endDate, e.stores, e.note);
  }
}

export default db;
