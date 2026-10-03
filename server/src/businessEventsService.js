// 出来事メモ(工事休業・新店オープンなど)。「サマリー」の自動総括
// (buildYearNarrative)が、売上の増減が実は一時的な休業や新店オープンに
// よるものだと分かっている場合に、その背景を文中に反映するために使う。
import db from "./db.js";

function normalizeStoresInput(stores) {
  if (Array.isArray(stores)) stores = stores.join(",");
  const trimmed = typeof stores === "string" ? stores.trim() : "";
  return trimmed === "" ? null : trimmed;
}

export function listBusinessEvents() {
  return db.prepare(`SELECT * FROM business_events ORDER BY start_date DESC, id DESC`).all();
}

export function createBusinessEvent({ startDate, endDate, stores, note }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO business_events (start_date, end_date, stores, note) VALUES (?, ?, ?, ?)`)
    .run(startDate, endDate, normalizeStoresInput(stores), note);
  return db.prepare(`SELECT * FROM business_events WHERE id = ?`).get(lastInsertRowid);
}

export function updateBusinessEvent(id, { startDate, endDate, stores, note }) {
  const existing = db.prepare(`SELECT * FROM business_events WHERE id = ?`).get(id);
  if (!existing) return null;
  const next = {
    start_date: startDate !== undefined ? startDate : existing.start_date,
    end_date: endDate !== undefined ? endDate : existing.end_date,
    stores: stores !== undefined ? normalizeStoresInput(stores) : existing.stores,
    note: note !== undefined ? note : existing.note,
  };
  db.prepare(`UPDATE business_events SET start_date = ?, end_date = ?, stores = ?, note = ? WHERE id = ?`).run(
    next.start_date,
    next.end_date,
    next.stores,
    next.note,
    id
  );
  return db.prepare(`SELECT * FROM business_events WHERE id = ?`).get(id);
}

export function deleteBusinessEvent(id) {
  db.prepare(`DELETE FROM business_events WHERE id = ?`).run(id);
}

/** Events overlapping [rangeStart, rangeEnd] (ISO dates, inclusive), for buildYearNarrative. */
export function listBusinessEventsInRange(rangeStart, rangeEnd) {
  return db
    .prepare(`SELECT * FROM business_events WHERE start_date <= ? AND end_date >= ? ORDER BY start_date`)
    .all(rangeEnd, rangeStart);
}
