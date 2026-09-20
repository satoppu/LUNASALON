// 日次動向の「予約受付件数」— 過去の実装(aggregations.js に混ざっていた
// buildDailyTrends)で原因不明のメモリ急増が起きたため、切り離して作り直した
// 最小構成。allRowsをなめて集計するのではなく、直近10日間のbooking_dateに
// 絞ったSELECTだけを行うことで、テーブル全体のサイズに依存しない小さく
// 一定のコストに抑えている。
import db from "./db.js";
import { getTodayISO, REVENUE_STATUSES } from "./config.js";

const WINDOW_DAYS = 10;

function shiftISODate(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * 予約(または定期クーポン購入)が行われた日(booking_date基準、利用日では
 * ない)ごとの件数と売上を、直近10日間(今日を含む)分。売上は他の売上集計
 * と同じeffectiveRevenueのルール(REVENUE_STATUSES)に従う。
 */
export function getNewBookingsDaily() {
  const today = getTodayISO();
  const start = shiftISODate(today, -(WINDOW_DAYS - 1));

  const rows = db
    .prepare(`SELECT booking_date AS date, status, revenue FROM transactions WHERE booking_date >= ? AND booking_date <= ?`)
    .all(start, today);

  const countByDate = new Map();
  const revenueByDate = new Map();
  for (const r of rows) {
    countByDate.set(r.date, (countByDate.get(r.date) || 0) + 1);
    if (REVENUE_STATUSES.has(r.status)) {
      revenueByDate.set(r.date, (revenueByDate.get(r.date) || 0) + r.revenue);
    }
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    days.push({ date, count: countByDate.get(date) || 0, revenue: revenueByDate.get(date) || 0 });
  }
  return days;
}
