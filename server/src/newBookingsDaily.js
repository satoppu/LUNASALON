// 日次動向の「新規予約件数」— 過去の実装(aggregations.js に混ざっていた
// buildDailyTrends)で原因不明のメモリ急増が起きたため、切り離して作り直した
// 最小構成。集計をJS側でallRowsをなめて行うのではなくSQLのGROUP BYで直接
// 行うことで、テーブル全体のサイズに依存しない小さく一定のコストに抑えている。
import db from "./db.js";
import { getTodayISO } from "./config.js";

const WINDOW_DAYS = 10;

function shiftISODate(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * その日に予約が入った件数(booking_date基準、ステータス問わず)を、
 * 直近10日間(今日を含む)分。
 */
export function getNewBookingsDaily() {
  const today = getTodayISO();
  const start = shiftISODate(today, -(WINDOW_DAYS - 1));

  const rows = db
    .prepare(`SELECT booking_date AS date, COUNT(*) AS count FROM transactions WHERE booking_date >= ? AND booking_date <= ? GROUP BY booking_date`)
    .all(start, today);
  const byDate = new Map(rows.map((r) => [r.date, r.count]));

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    days.push({ date, count: byDate.get(date) || 0 });
  }
  return days;
}
