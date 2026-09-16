import db from "./db.js";

const MAX_LIMIT = 100;

/**
 * Searches transactions by an optional inclusive date range, store, status,
 * and a partial (case-insensitive) match on user_name, capped at 100 rows
 * per page with offset-based pagination.
 */
export function searchTransactions({ start, end, store, status, user, limit, offset, sort } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || MAX_LIMIT, 1), MAX_LIMIT);
  const cappedOffset = Math.max(Number(offset) || 0, 0);
  const direction = sort === "asc" ? "ASC" : "DESC"; // whitelisted, never interpolated from raw input otherwise
  const conditions = [];
  const params = {};
  if (start) {
    conditions.push("date >= @start");
    params.start = start;
  }
  if (end) {
    conditions.push("date <= @end");
    params.end = end;
  }
  if (store) {
    conditions.push("store = @store");
    params.store = store;
  }
  if (status) {
    conditions.push("status = @status");
    params.status = status;
  }
  if (user) {
    conditions.push("user_name LIKE @user ESCAPE '\\'");
    params.user = `%${user.replace(/[\\%_]/g, "\\$&")}%`;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date ${direction}, id ${direction} LIMIT ${cappedLimit} OFFSET ${cappedOffset}`)
    .all(params);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM transactions ${where}`).get(params).c;

  return { rows, total, limit: cappedLimit, offset: cappedOffset };
}

/** Distinct store/status values actually present in transactions, for filter dropdowns. */
export function getTransactionFilters() {
  const stores = db.prepare("SELECT DISTINCT store FROM transactions ORDER BY store").all().map((r) => r.store);
  const statuses = db.prepare("SELECT DISTINCT status FROM transactions ORDER BY status").all().map((r) => r.status);
  return { stores, statuses };
}
