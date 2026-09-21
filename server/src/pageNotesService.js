import db from "./db.js";

// Sidebar.jsx NAV_ITEMSと一致させる(settingsは記録タブ自身なので対象外だが、
// 誤って指定されても弾く必要はないのでそのまま許可)。
const VALID_PAGE_KEYS = new Set([
  "summary",
  "daily",
  "revenue",
  "occupancy",
  "customers",
  "customerList",
  "recent",
  "channel",
  "reference",
  "settings",
]);

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
