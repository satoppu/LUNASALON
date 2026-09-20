// 日次動向の「予約受付件数」— 過去の実装(aggregations.js に混ざっていた
// buildDailyTrends)で原因不明のメモリ急増が起きたため、切り離して作り直した
// 最小構成。allRowsをなめて集計するのではなく、直近10日間のbooking_dateに
// 絞ったSELECTだけを行うことで、テーブル全体のサイズに依存しない小さく
// 一定のコストに抑えている。
import db from "./db.js";
import { getTodayISO, REVENUE_STATUSES, SUBSCRIPTION_STATUS, isCancellationStatus } from "./config.js";

const WINDOW_DAYS = 10;

function shiftISODate(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * 予約(または定期クーポン購入)が行われた日(booking_date基準、利用日では
 * ない)ごとの件数と売上を、直近10日間分。offsetWindowsを1増やすごとに、
 * その10日ブロックをまるごと1つ過去にずらす(例: offsetWindows=1は
 * 「今日から数えて11〜20日前」)。どちらもbooking_dateの範囲を絞った
 * SELECTのみなので、offsetWindowsの大小やテーブル全体のサイズに関係なく
 * 一定のコストに収まる。
 *
 * 件数は通常予約・キャンセル・定期クーポンの3つに分けて集計する(積み上げ
 * 棒グラフ用)。売上は他の売上集計と同じeffectiveRevenueのルール
 * (REVENUE_STATUSES、定期クーポン込み)に従う。
 */
export function getNewBookingsDaily(offsetWindows = 0) {
  const today = getTodayISO();
  const end = shiftISODate(today, -WINDOW_DAYS * offsetWindows);
  const start = shiftISODate(end, -(WINDOW_DAYS - 1));

  const rows = db
    .prepare(`SELECT booking_date AS date, status, revenue FROM transactions WHERE booking_date >= ? AND booking_date <= ?`)
    .all(start, end);

  const countByDate = new Map();
  const cancelCountByDate = new Map();
  const subscriptionCountByDate = new Map();
  const revenueByDate = new Map();
  for (const r of rows) {
    const counts = r.status === SUBSCRIPTION_STATUS
      ? subscriptionCountByDate
      : isCancellationStatus(r.status)
        ? cancelCountByDate
        : countByDate;
    counts.set(r.date, (counts.get(r.date) || 0) + 1);
    if (REVENUE_STATUSES.has(r.status)) {
      revenueByDate.set(r.date, (revenueByDate.get(r.date) || 0) + r.revenue);
    }
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    days.push({
      date,
      count: countByDate.get(date) || 0,
      cancelCount: cancelCountByDate.get(date) || 0,
      subscriptionCount: subscriptionCountByDate.get(date) || 0,
      revenue: revenueByDate.get(date) || 0,
    });
  }
  return days;
}

/** Rows whose booking_date is the given day — the detail behind one bar of getNewBookingsDaily(). */
export function getBookingsForDate(bookingDate) {
  return db
    .prepare(
      `SELECT date, store, user_name, revenue, status, channel FROM transactions WHERE booking_date = ? ORDER BY user_name`
    )
    .all(bookingDate);
}
