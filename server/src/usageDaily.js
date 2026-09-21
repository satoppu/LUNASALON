// 日次動向の「利用売上・利用件数」— newBookingsDaily.jsの予約日ベース版と対の、
// 利用日(date列、実際に部屋を使った/使う予定の日)ベースの直近10日間集計。
// クエリの絞り込み対象がbooking_date/cancelled_dateではなくdateになる点以外は
// 同じ設計(小さく一定のコストに抑える10日窓、offsetWindowsで過去にずらす)。
import db from "./db.js";
import { getTodayISO, SUBSCRIPTION_STATUS, HOURS_USED_STATUSES } from "./config.js";

const WINDOW_DAYS = 10;

// newBookingsDaily.jsと同じUTC基準の日付シフト(タイムゾーン非依存)。
function shiftISODate(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * 利用日(date)ごとの件数と売上、直近10日間分。「今日」はまだ終わっていない
 * ため一番新しい日は前日(JST基準)。通常の利用(HOURS_USED_STATUSES=利用済み/
 * 利用前)と定期クーポン(SUBSCRIPTION_STATUS)を分けて集計する — キャンセルは
 * 実際には利用していないためここには含めない。
 */
export function getUsageDaily(offsetWindows = 0, store) {
  const yesterday = shiftISODate(getTodayISO(), -1);
  const end = shiftISODate(yesterday, -WINDOW_DAYS * offsetWindows);
  const start = shiftISODate(end, -(WINDOW_DAYS - 1));

  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [start, end, store] : [start, end];
  const rows = db
    .prepare(`SELECT date, status, revenue FROM transactions WHERE date >= ? AND date <= ? ${storeClause}`)
    .all(...params);

  const countByDate = new Map();
  const subscriptionCountByDate = new Map();
  const usageRevenueByDate = new Map();
  const subscriptionRevenueByDate = new Map();
  const add = (map, date, amount) => map.set(date, (map.get(date) || 0) + amount);

  for (const r of rows) {
    if (r.status === SUBSCRIPTION_STATUS) {
      add(subscriptionCountByDate, r.date, 1);
      add(subscriptionRevenueByDate, r.date, r.revenue);
    } else if (HOURS_USED_STATUSES.has(r.status)) {
      add(countByDate, r.date, 1);
      add(usageRevenueByDate, r.date, r.revenue);
    }
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    const usageRevenue = usageRevenueByDate.get(date) || 0;
    const subscriptionRevenue = subscriptionRevenueByDate.get(date) || 0;
    days.push({
      date,
      count: countByDate.get(date) || 0,
      subscriptionCount: subscriptionCountByDate.get(date) || 0,
      usageRevenue,
      subscriptionRevenue,
      revenue: usageRevenue + subscriptionRevenue,
    });
  }
  return days;
}

/**
 * ある1日の利用明細(getUsageDaily()の棒をクリックした時の内訳)。集計と同じく
 * 利用済み/利用前/定期クーポンのみ(キャンセルは実際には利用していないため除く)。
 */
export function getUsageForDate(date, store) {
  const includedStatuses = [...HOURS_USED_STATUSES, SUBSCRIPTION_STATUS];
  const statusPlaceholders = includedStatuses.map(() => "?").join(", ");
  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [date, ...includedStatuses, store] : [date, ...includedStatuses];
  return db
    .prepare(
      `SELECT date, booking_date, store, user_name, revenue, status, channel
       FROM transactions
       WHERE date = ? AND status IN (${statusPlaceholders}) ${storeClause}
       ORDER BY user_name`
    )
    .all(...params);
}
