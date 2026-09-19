import db from "./db.js";
import { DEFAULT_OPERATING_HOURS_PER_DAY } from "./config.js";

export function listStoreSettings() {
  return db.prepare(`SELECT * FROM store_settings ORDER BY sort_order, store`).all();
}

export function getStoreSetting(store) {
  return db.prepare(`SELECT * FROM store_settings WHERE store = ?`).get(store);
}

/** Registers a store seen in imported data that has no settings row yet. */
export function ensureStoreRegistered(store) {
  const existing = getStoreSetting(store);
  if (existing) return existing;
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), -1) AS m FROM store_settings`).get().m;
  db.prepare(
    `INSERT INTO store_settings (store, area, color, operating_hours_per_day, sort_order) VALUES (?, NULL, ?, ?, ?)`
  ).run(store, "#8F7D6E", DEFAULT_OPERATING_HOURS_PER_DAY, maxOrder + 1);
  return getStoreSetting(store);
}

export function updateStoreSetting(store, { area, color, openDate, operatingHoursPerDay }) {
  const existing = ensureStoreRegistered(store);
  const next = {
    area: area !== undefined ? area : existing.area,
    color: color !== undefined ? color : existing.color,
    open_date: openDate !== undefined ? openDate : existing.open_date,
    operating_hours_per_day:
      operatingHoursPerDay !== undefined ? operatingHoursPerDay : existing.operating_hours_per_day,
  };
  db.prepare(
    `UPDATE store_settings SET area = ?, color = ?, open_date = ?, operating_hours_per_day = ? WHERE store = ?`
  ).run(next.area, next.color, next.open_date, next.operating_hours_per_day, store);
  return getStoreSetting(store);
}
