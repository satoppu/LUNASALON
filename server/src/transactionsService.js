import db from "./db.js";

const MAX_LIMIT = 100;

/**
 * Shared filter-clause builder for searchTransactions/exportTransactions.
 * status accepts either a single status or a comma-separated list (e.g. to
 * group 利用済み+利用前 as "usage", or every キャンセル(...) variant as one
 * filter) — the 累計利用回数/累計キャンセル数/クーポン購入回数 drill-down
 * links on customer detail rely on this.
 */
function buildFilterClause({ start, end, store, status, user }) {
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
    const statuses = status
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length === 1) {
      conditions.push("status = @status");
      params.status = statuses[0];
    } else if (statuses.length > 1) {
      const placeholders = statuses.map((_, i) => `@status${i}`);
      conditions.push(`status IN (${placeholders.join(", ")})`);
      statuses.forEach((s, i) => {
        params[`status${i}`] = s;
      });
    }
  }
  if (user) {
    conditions.push("user_name LIKE @user ESCAPE '\\'");
    params.user = `%${user.replace(/[\\%_]/g, "\\$&")}%`;
  }
  return { where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

/**
 * Searches transactions by an optional inclusive date range, store, status
 * (single value or comma-separated list), and a partial (case-insensitive)
 * match on user_name, capped at 100 rows per page with offset-based
 * pagination.
 */
export function searchTransactions({ start, end, store, status, user, limit, offset, sort } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || MAX_LIMIT, 1), MAX_LIMIT);
  const cappedOffset = Math.max(Number(offset) || 0, 0);
  const direction = sort === "asc" ? "ASC" : "DESC"; // whitelisted, never interpolated from raw input otherwise
  const { where, params } = buildFilterClause({ start, end, store, status, user });

  const rows = db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date ${direction}, id ${direction} LIMIT ${cappedLimit} OFFSET ${cappedOffset}`)
    .all(params);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM transactions ${where}`).get(params).c;

  return { rows, total, limit: cappedLimit, offset: cappedOffset };
}

/**
 * Same filtering as searchTransactions (date range, store, status, partial
 * user_name match) but returns every matching row, unpaginated, for CSV
 * export.
 */
export function exportTransactions({ start, end, store, status, user, sort } = {}) {
  const direction = sort === "asc" ? "ASC" : "DESC"; // whitelisted, never interpolated from raw input otherwise
  const { where, params } = buildFilterClause({ start, end, store, status, user });

  return db.prepare(`SELECT * FROM transactions ${where} ORDER BY date ${direction}, id ${direction}`).all(params);
}

/** Distinct store/status values actually present in transactions, for filter dropdowns. */
export function getTransactionFilters() {
  const stores = db.prepare("SELECT DISTINCT store FROM transactions ORDER BY store").all().map((r) => r.store);
  const statuses = db.prepare("SELECT DISTINCT status FROM transactions ORDER BY status").all().map((r) => r.status);
  return { stores, statuses };
}
