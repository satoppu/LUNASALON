// 日次動向の「利用売上・利用件数」— newBookingsDaily.jsの予約日ベース版と対の、
// 利用日(date列、実際に部屋を使った/使う予定の日)ベースの直近10日間集計。
// クエリの絞り込み対象がbooking_date/cancelled_dateではなくdateになる点以外は
// 同じ設計(小さく一定のコストに抑える10日窓、offsetWindowsで過去にずらす)。
import db from "./db.js";
import { getTodayISO, HOURS_USED_STATUSES } from "./config.js";

const WINDOW_DAYS = 10;

// newBookingsDaily.jsと同じUTC基準の日付シフト(タイムゾーン非依存)。
function shiftISODate(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

const USAGE_STATUS_LIST = [...HOURS_USED_STATUSES];
const USAGE_STATUS_PLACEHOLDERS = USAGE_STATUS_LIST.map(() => "?").join(", ");

/**
 * 利用日(date)ごとの件数と売上、直近10日間分。「今日」はまだ終わっていない
 * ため一番新しい日は前日(JST基準)。通常の利用(HOURS_USED_STATUSES=利用済み/
 * 利用前)のみが対象 — 定期クーポンは利用日という概念に馴染まないため含めず、
 * キャンセルは実際には利用していないためここには含めない。
 */
export function getUsageDaily(offsetWindows = 0, store) {
  const yesterday = shiftISODate(getTodayISO(), -1);
  const end = shiftISODate(yesterday, -WINDOW_DAYS * offsetWindows);
  const start = shiftISODate(end, -(WINDOW_DAYS - 1));

  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [start, end, ...USAGE_STATUS_LIST, store] : [start, end, ...USAGE_STATUS_LIST];
  const rows = db
    .prepare(
      `SELECT date, revenue
       FROM transactions
       WHERE date >= ? AND date <= ? AND status IN (${USAGE_STATUS_PLACEHOLDERS}) ${storeClause}`
    )
    .all(...params);

  const countByDate = new Map();
  const revenueByDate = new Map();
  const add = (map, date, amount) => map.set(date, (map.get(date) || 0) + amount);

  for (const r of rows) {
    add(countByDate, r.date, 1);
    add(revenueByDate, r.date, r.revenue);
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    days.push({
      date,
      count: countByDate.get(date) || 0,
      revenue: revenueByDate.get(date) || 0,
    });
  }
  return days;
}

/**
 * ある1日の利用明細(getUsageDaily()の棒をクリックした時の内訳)。集計と同じく
 * 利用済み/利用前のみ(キャンセル・定期クーポンは含まない)。
 */
export function getUsageForDate(date, store) {
  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [date, ...USAGE_STATUS_LIST, store] : [date, ...USAGE_STATUS_LIST];
  return db
    .prepare(
      `SELECT date, booking_date, store, user_name, revenue, status, channel
       FROM transactions
       WHERE date = ? AND status IN (${USAGE_STATUS_PLACEHOLDERS}) ${storeClause}
       ORDER BY user_name`
    )
    .all(...params);
}
