import db from "./db.js";

const VALID_PAGE_KEYS = new Set(["summary", "revenue", "occupancy", "channel", "ranking", "customers", "recent", "settings"]);

export function isValidPageKey(pageKey) {
  return VALID_PAGE_KEYS.has(pageKey);
}

export function getPageNote(pageKey) {
  const row = db.prepare(`SELECT page_key, reflection, todo, updated_at FROM page_notes WHERE page_key = ?`).get(pageKey);
  return row || { page_key: pageKey, reflection: "", todo: "", updated_at: null };
}

export function savePageNote(pageKey, { reflection, todo }) {
  db.prepare(
    `INSERT INTO page_notes (page_key, reflection, todo, updated_at)
     VALUES (@page_key, @reflection, @todo, datetime('now'))
     ON CONFLICT(page_key) DO UPDATE SET reflection = excluded.reflection, todo = excluded.todo, updated_at = excluded.updated_at`
  ).run({ page_key: pageKey, reflection: reflection || "", todo: todo || "" });
  return getPageNote(pageKey);
}
