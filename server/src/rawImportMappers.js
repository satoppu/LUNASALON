// Row-level mapping for the reservation platform's own raw CSV exports —
// shared between the CLI tools (importRawBookings.js / importRawSubscriptions.js)
// and the web /api/import endpoint (importService.js), so both paths apply
// the exact same business rules.
import { SUBSCRIPTION_STATUS } from "./config.js";
import { canonicalizeUserName, resolveStoreForUser } from "./importHelpers.js";

const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];
const STORE_PREFIX = "レンタルサロン ";
const BOOKING_CHANNEL = "自社サイト"; // this export shape is 自社サイト-only bookings.

/**
 * Detects which raw export shape a parsed CSV's header row matches, or null
 * if it looks like the dashboard's own simple CSV template instead.
 */
export function detectRawFormat(fields) {
  const set = new Set(fields || []);
  if (set.has("スペース名") && set.has("状態") && set.has("利用日時")) return "rawBooking";
  if (set.has("クーポン名") && set.has("購入日時")) return "rawSubscription";
  return null;
}

function parseUsage(raw) {
  const m = String(raw).match(/^(\d{2})\/(\d{2})\s*\(.\)\s*(\d{1,2}):(\d{2})[〜~](\d{1,2}):(\d{2})/u);
  if (!m) return null;
  return {
    month: Number(m[1]),
    day: Number(m[2]),
    startHour: Number(m[3]),
    startMin: Number(m[4]),
    endHour: Number(m[5]),
    endMin: Number(m[6]),
  };
}

// Usage normally happens on/after the payment date; if the usage month is
// earlier than the payment month, the booking crosses a New Year boundary.
function resolveYear(usageMonth, paymentISODate) {
  const paymentYear = Number(paymentISODate.slice(0, 4));
  const paymentMonth = Number(paymentISODate.slice(5, 7));
  return usageMonth < paymentMonth ? paymentYear + 1 : paymentYear;
}

function mapBookingStatus(rawStatus, revenue) {
  if (rawStatus === "利用済み") return "利用済み";
  if (rawStatus === "キャンセル(顧客)") return revenue > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  if (rawStatus === "キャンセル(オーナー)") return "キャンセル(オーナー)";
  return null; // 未確定 or an unrecognized status
}

/**
 * Maps one row of a raw booking export (columns: スペース名,顧客名,HN,決済元金,
 * 割引金額,返金額,利益確定後返金,利益,使用クーポン,決済方法,状態,決済日時,
 * 決済日時（データ入力用）,利用日時,売り上げ確定日時,決済ID) to a transactions
 * row, or null if the row should be skipped (状態="未確定"/unrecognized, or
 * unparseable). See spec 4.2-4.4 for the status/revenue business rules.
 */
export function mapRawBookingRow(raw) {
  const revenue = Number(raw["利益"]) || 0;
  const status = mapBookingStatus(raw["状態"], revenue);
  const usage = parseUsage(raw["利用日時"]);
  const paymentISO = raw["決済日時（データ入力用）"];
  if (!status || !usage || !paymentISO) return null;

  const year = resolveYear(usage.month, paymentISO);
  const date = `${year}-${String(usage.month).padStart(2, "0")}-${String(usage.day).padStart(2, "0")}`;
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  const hoursUsed =
    status === "利用済み" ? (usage.endHour * 60 + usage.endMin - (usage.startHour * 60 + usage.startMin)) / 60 : 0;

  return {
    date,
    store: String(raw["スペース名"]).replace(STORE_PREFIX, "").trim(),
    user_name: canonicalizeUserName(raw["顧客名"]),
    revenue,
    hours_used: hoursUsed,
    start_hour: usage.startHour,
    weekday,
    channel: BOOKING_CHANNEL,
    status,
    external_id: raw["決済ID"] || null,
  };
}

/**
 * Maps one row of a raw 定期クーポン purchase export (columns: クーポン名,
 * 顧客名,金額,返金額,利益,支払いID,購入日時) to a transactions row, linking it
 * to whichever store the customer has the most other transactions at. Returns
 * null if the row is unparseable or the customer has no usage history yet to
 * resolve a store from.
 */
export function mapRawSubscriptionRow(raw) {
  const date = String(raw["購入日時"] || "").slice(0, 10);
  const revenueRaw = raw["利益"] !== "" && raw["利益"] != null ? raw["利益"] : raw["金額"];
  const revenue = Number(String(revenueRaw).replace(/,/g, ""));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(revenue)) return null;

  const userName = canonicalizeUserName(raw["顧客名"]);
  const store = resolveStoreForUser(userName);
  if (!store) return null;

  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  return {
    date,
    store,
    user_name: userName,
    revenue,
    hours_used: 0,
    start_hour: null,
    weekday,
    channel: SUBSCRIPTION_STATUS,
    status: SUBSCRIPTION_STATUS,
    external_id: raw["支払いID"] || null,
  };
}
