// 日次動向の「予約受付件数」— 過去の実装(aggregations.js に混ざっていた
// buildDailyTrends)で原因不明のメモリ急増が起きたため、切り離して作り直した
// 最小構成。allRowsをなめて集計するのではなく、直近10日間のbooking_dateに
// 絞ったSELECTだけを行うことで、テーブル全体のサイズに依存しない小さく
// 一定のコストに抑えている。
import db from "./db.js";
import { getTodayISO, REVENUE_STATUSES, SUBSCRIPTION_STATUS, isCancellationStatus } from "./config.js";

const WINDOW_DAYS = 10;

// 決済元金(booking_amount)はキャンセル時にも「本来の予約金額」として自社
// サイトの行にだけ保存される(rawImportMappers.js mapRawBookingRow)。他の
// チャネル(Instabase/スペースマーケットなど)のキャンセルにはこの元金が
// 無いため、キャンセル代(失った売上)は自社サイト分のみ算出する。
const OWN_SITE_CHANNEL = "自社サイト";

// UTC基準で組み立て・計算するため、プロセスのタイムゾーン設定に一切
// 依存しない。`new Date(iso + "T00:00:00")` はゾーン指定が無いためローカル
// 時刻として解釈される — サーバーのタイムゾーンがJST(UTC+9)だと、ローカル
// 深夜0時は内部的にUTCでは前日15時になり、そこから`toISOString()`で
// UTCの日付を取り出すと1日ずれる(この関数は呼び出しがネストするたびに
// ズレが積み重なる)。UTCのgetter/setterだけで完結させることでこれを防ぐ。
function shiftISODate(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * 予約(または定期クーポン購入)が行われた日(booking_date基準、利用日では
 * ない)ごとの件数と売上を、直近10日間分。「今日」はまだ終わっておらず
 * 件数・売上が必ず不完全な値になるため、一番新しい日は今日ではなく前日
 * (JST基準)にしている。offsetWindowsを1増やすごとに、その10日ブロックを
 * まるごと1つ過去にずらす(例: offsetWindows=1は「前日から数えて11〜20日
 * 前」)。どちらもbooking_dateの範囲を絞ったSELECTのみなので、
 * offsetWindowsの大小やテーブル全体のサイズに関係なく一定のコストに収まる。
 *
 * 件数は通常予約・キャンセル・定期クーポンの3つに分けて集計する(積み上げ
 * 棒グラフ用)。売上は「予約(利用済み/利用前)+定期クーポン」の粗売上
 * (grossRevenue)から、キャンセル代(cancelRevenue — 自社サイトの本来の
 * 予約金額とキャンセル後に実際に残った売上の差額。他チャネルのキャンセル
 * は本来の予約金額を保持していないため0として扱う)を差し引いた金額
 * (revenue = grossRevenue - cancelRevenue)。
 */
export function getNewBookingsDaily(offsetWindows = 0, store) {
  const yesterday = shiftISODate(getTodayISO(), -1);
  const end = shiftISODate(yesterday, -WINDOW_DAYS * offsetWindows);
  const start = shiftISODate(end, -(WINDOW_DAYS - 1));

  const rows = store
    ? db
        .prepare(
          `SELECT booking_date AS date, status, channel, revenue, booking_amount FROM transactions WHERE booking_date >= ? AND booking_date <= ? AND store = ?`
        )
        .all(start, end, store)
    : db
        .prepare(
          `SELECT booking_date AS date, status, channel, revenue, booking_amount FROM transactions WHERE booking_date >= ? AND booking_date <= ?`
        )
        .all(start, end);

  const countByDate = new Map();
  const cancelCountByDate = new Map();
  const subscriptionCountByDate = new Map();
  const grossRevenueByDate = new Map();
  const cancelRevenueByDate = new Map();
  const add = (map, date, amount) => map.set(date, (map.get(date) || 0) + amount);

  for (const r of rows) {
    if (r.status === SUBSCRIPTION_STATUS) {
      add(subscriptionCountByDate, r.date, 1);
      add(grossRevenueByDate, r.date, r.revenue);
    } else if (isCancellationStatus(r.status)) {
      add(cancelCountByDate, r.date, 1);
      if (r.channel === OWN_SITE_CHANNEL && r.booking_amount != null) {
        add(cancelRevenueByDate, r.date, r.booking_amount - r.revenue);
      }
    } else {
      add(countByDate, r.date, 1);
      if (REVENUE_STATUSES.has(r.status)) {
        add(grossRevenueByDate, r.date, r.revenue);
      }
    }
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    const grossRevenue = grossRevenueByDate.get(date) || 0;
    const cancelRevenue = cancelRevenueByDate.get(date) || 0;
    days.push({
      date,
      count: countByDate.get(date) || 0,
      cancelCount: cancelCountByDate.get(date) || 0,
      subscriptionCount: subscriptionCountByDate.get(date) || 0,
      grossRevenue,
      cancelRevenue,
      revenue: grossRevenue - cancelRevenue,
    });
  }
  return days;
}

/** Rows whose booking_date is the given day — the detail behind one bar of getNewBookingsDaily(). */
export function getBookingsForDate(bookingDate, store) {
  return store
    ? db
        .prepare(
          `SELECT date, store, user_name, revenue, status, channel FROM transactions WHERE booking_date = ? AND store = ? ORDER BY user_name`
        )
        .all(bookingDate, store)
    : db
        .prepare(
          `SELECT date, store, user_name, revenue, status, channel FROM transactions WHERE booking_date = ? ORDER BY user_name`
        )
        .all(bookingDate);
}
