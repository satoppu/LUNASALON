// 日次動向の「予約受付件数」— 過去の実装(aggregations.js に混ざっていた
// buildDailyTrends)で原因不明のメモリ急増が起きたため、切り離して作り直した
// 最小構成。allRowsをなめて集計するのではなく、直近10日間のbooking_date/
// cancelled_dateに絞ったSELECTだけを行うことで、テーブル全体のサイズに
// 依存しない小さく一定のコストに抑えている(どちらも索引あり)。
import db from "./db.js";
import { getTodayISO, REVENUE_STATUSES, SUBSCRIPTION_STATUS, isCancellationStatus } from "./config.js";

const WINDOW_DAYS = 10;

// 決済元金(booking_amount)はキャンセル時にも「本来の予約金額」として自社
// サイトの行にだけ保存される(rawImportMappers.js mapRawBookingRow)。他の
// チャネル(Instabase/スペースマーケットなど)のキャンセルにはこの元金が
// 無いため、日をまたいだ分割ができず、そのままキャンセル扱いにする。
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
 * 前」)。booking_date/cancelled_dateの範囲を絞ったSELECTのみなので、
 * offsetWindowsの大小やテーブル全体のサイズに関係なく一定のコストに収まる。
 *
 * 予約した日にその日の売上として計上し、後日キャンセルされた場合はキャンセル
 * が確定した日(cancelled_date — 日次自動取り込みが最初にキャンセルへの
 * 変化を検知した日、importService.js。無ければbooking_dateにフォールバック)
 * の売上から差し引く — 実店舗の会計感覚に合わせた日ごとの分割計上(自社
 * サイトのbooking_amountを保持する行のみ可能。他チャネルは本来の予約金額を
 * 保持していないため、従来通りbooking_date側に「取消」として計上する)。
 * cancelled_dateが正しく当日を指すには、毎朝の自動取り込み
 * (autoFetchImport.js)が予約可能な最大期間(6ヶ月先)を毎日カバーし続けて
 * いる必要がある — 取り込みの空白期間があると、その間のキャンセルは後から
 * しか検知できず、cancelled_dateが実際より遅れる。
 *
 * 件数は通常予約・キャンセル・定期クーポンの3つに分けて集計する(積み上げ
 * 棒グラフ用)。売上は利用売上(bookingRevenue — 予約(利用済み/利用前)の
 * 売上、キャンセルされた行はbooking_date側にbooking_amount全額を計上)と
 * 定額売上(subscriptionRevenue — 定期クーポンの売上)を分けて持ち、その
 * 合計からキャンセル代(cancelRevenue — 自社サイトの本来の予約金額と
 * キャンセル後に実際に残った売上の差額。他チャネルのキャンセルは本来の
 * 予約金額を保持していないため0として扱う)を差し引いた金額が最終的な
 * 予約売上(revenue = bookingRevenue + subscriptionRevenue - cancelRevenue)。
 */
export function getNewBookingsDaily(offsetWindows = 0, store) {
  const yesterday = shiftISODate(getTodayISO(), -1);
  const end = shiftISODate(yesterday, -WINDOW_DAYS * offsetWindows);
  const start = shiftISODate(end, -(WINDOW_DAYS - 1));

  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [start, end, start, end, store] : [start, end, start, end];
  const rows = db
    .prepare(
      `SELECT booking_date AS date, cancelled_date, status, channel, revenue, booking_amount
       FROM transactions
       WHERE ((booking_date >= ? AND booking_date <= ?) OR (cancelled_date >= ? AND cancelled_date <= ?))
       ${storeClause}`
    )
    .all(...params);

  const countByDate = new Map();
  const cancelCountByDate = new Map();
  const subscriptionCountByDate = new Map();
  const bookingRevenueByDate = new Map();
  const subscriptionRevenueByDate = new Map();
  const cancelRevenueByDate = new Map();
  const add = (map, date, amount) => map.set(date, (map.get(date) || 0) + amount);
  const inWindow = (d) => d != null && d >= start && d <= end;

  for (const r of rows) {
    if (r.status === SUBSCRIPTION_STATUS) {
      if (inWindow(r.date)) {
        add(subscriptionCountByDate, r.date, 1);
        add(subscriptionRevenueByDate, r.date, r.revenue);
      }
    } else if (isCancellationStatus(r.status)) {
      if (r.channel === OWN_SITE_CHANNEL && r.booking_amount != null) {
        // 予約日に全額計上、キャンセル確定日にその分を差し引く(同じ日なら
        // 両方が同じ日のバケットに乗るだけで、実質は従来通りの単日相殺)。
        const confirmDate = r.cancelled_date || r.date;
        if (inWindow(r.date)) {
          add(countByDate, r.date, 1);
          add(bookingRevenueByDate, r.date, r.booking_amount);
        }
        if (inWindow(confirmDate)) {
          add(cancelCountByDate, confirmDate, 1);
          add(cancelRevenueByDate, confirmDate, r.booking_amount - r.revenue);
        }
      } else if (inWindow(r.date)) {
        add(cancelCountByDate, r.date, 1);
      }
    } else if (inWindow(r.date)) {
      add(countByDate, r.date, 1);
      if (REVENUE_STATUSES.has(r.status)) {
        add(bookingRevenueByDate, r.date, r.revenue);
      }
    }
  }

  const days = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const date = shiftISODate(start, i);
    const bookingRevenue = bookingRevenueByDate.get(date) || 0;
    const subscriptionRevenue = subscriptionRevenueByDate.get(date) || 0;
    const cancelRevenue = cancelRevenueByDate.get(date) || 0;
    days.push({
      date,
      count: countByDate.get(date) || 0,
      cancelCount: cancelCountByDate.get(date) || 0,
      subscriptionCount: subscriptionCountByDate.get(date) || 0,
      bookingRevenue,
      subscriptionRevenue,
      cancelRevenue,
      revenue: bookingRevenue + subscriptionRevenue - cancelRevenue,
    });
  }
  return days;
}

/**
 * ある1日の明細(getNewBookingsDaily()の棒をクリックした時の内訳)。
 * booking_date=その日(通常予約・定期クーポン・他チャネルのキャンセル)に
 * 加えて、自社サイトのキャンセルでcancelled_date=その日の行も含む(キャン
 * セル確定日側に「取消」として計上される行なので、明細にも出す)。
 */
export function getBookingsForDate(bookingDate, store) {
  const storeClause = store ? "AND store = ?" : "";
  const params = store ? [bookingDate, bookingDate, store] : [bookingDate, bookingDate];
  return db
    .prepare(
      `SELECT date, store, user_name, revenue, status, channel
       FROM transactions
       WHERE (booking_date = ? OR cancelled_date = ?) ${storeClause}
       ORDER BY user_name`
    )
    .all(...params);
}
