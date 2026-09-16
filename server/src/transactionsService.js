import db from "./db.js";

const MAX_LIMIT = 100;

/** Searches transactions by an optional inclusive date range, most recent first, capped at 100 rows. */
export function searchTransactions({ start, end, limit } = {}) {
  const cappedLimit = Math.min(Math.max(Number(limit) || MAX_LIMIT, 1), MAX_LIMIT);
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
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db.prepare(`SELECT * FROM transactions ${where} ORDER BY date DESC, id DESC LIMIT ${cappedLimit}`).all(params);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM transactions ${where}`).get(params).c;

  return { rows, total, limit: cappedLimit };
}
