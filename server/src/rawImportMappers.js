// Row-level mapping for the reservation platform's own raw CSV exports —
// shared between the CLI tools (importRawBookings.js / importRawSubscriptions.js)
// and the web /api/import endpoint (importService.js), so both paths apply
// the exact same business rules.
import { SUBSCRIPTION_STATUS, PENDING_STATUS, getTodayISO } from "./config.js";
import { canonicalizeUserName, resolveStoreForUser } from "./importHelpers.js";

const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];
const STORE_PREFIX = "レンタルサロン ";
const BOOKING_CHANNEL = "自社サイト"; // this export shape is 自社サイト-only bookings.
const INSTABASE_CHANNEL = "Instabase";

// 施設名 (facility name) substrings -> store, per the actual listing titles.
const INSTABASE_FACILITY_STORE = [
  { match: "つくば市初", store: "Asteria" },
  { match: "柏駅徒歩3分", store: "Bellezza" },
];

/**
 * Detects which raw export shape a parsed CSV's header row matches, or null
 * if it looks like the dashboard's own simple CSV template instead.
 */
export function detectRawFormat(fields) {
  const set = new Set(fields || []);
  if (set.has("スペース名") && set.has("状態") && set.has("利用日時")) return "rawBooking";
  if (set.has("クーポン名") && set.has("購入日時")) return "rawSubscription";
  if (set.has("予約ID") && set.has("施設名") && set.has("利用開始日時")) return "rawInstabase";
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

// "07/02 (木) 15:06:10" — no end time, unlike 利用日時.
function parseMonthDay(raw) {
  const m = String(raw).match(/^(\d{2})\/(\d{2})\s*\(.\)/u);
  if (!m) return null;
  return { month: Number(m[1]), day: Number(m[2]) };
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
  if (rawStatus === "未確定") return PENDING_STATUS; // confirmed/paid, usage date hasn't happened yet.
  if (rawStatus === "キャンセル(顧客)") return revenue > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  if (rawStatus === "キャンセル(オーナー)") return "キャンセル(オーナー)";
  return null; // unrecognized status
}

// "決済元金" minus the "-"-placeholder-or-negative "割引金額" (e.g. a coupon
// discount) nets to the same figure "利益" would eventually show once the
// platform finalizes it — needed because 利益 is always blank while a
// booking is still 未確定/PENDING_STATUS.
function parseDiscountedAmount(raw) {
  const base = Number(raw["決済元金"]) || 0;
  const discountRaw = raw["割引金額"];
  const discount = discountRaw == null || discountRaw === "-" || discountRaw === "" ? 0 : Number(discountRaw) || 0;
  return base + discount;
}

/**
 * Maps one row of a raw booking export (columns: スペース名,顧客名,HN,決済元金,
 * 割引金額,返金額,利益確定後返金,利益,使用クーポン,決済方法,状態,決済日時,
 * 決済日時（データ入力用）,利用日時,売り上げ確定日時,決済ID) to a transactions
 * row, or null if the row is unrecognized/unparseable. See spec 4.2-4.4 for
 * the status/revenue business rules; a 状態="未確定" row (PENDING_STATUS,
 * "利用前") counts toward revenue via 決済元金+割引金額 (利益 is still blank
 * for these) but not toward hours_used, since the visit hasn't happened yet.
 */
export function mapRawBookingRow(raw) {
  const isPending = raw["状態"] === "未確定";
  const revenue = isPending ? parseDiscountedAmount(raw) : Number(raw["利益"]) || 0;
  const status = mapBookingStatus(raw["状態"], revenue);
  const usage = parseUsage(raw["利用日時"]);
  const paymentISO = raw["決済日時（データ入力用）"];
  if (!status || !usage || !paymentISO) return null;

  const year = resolveYear(usage.month, paymentISO);
  const date = `${year}-${String(usage.month).padStart(2, "0")}-${String(usage.day).padStart(2, "0")}`;
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  const hoursUsed =
    status === "利用済み" ? (usage.endHour * 60 + usage.endMin - (usage.startHour * 60 + usage.startMin)) / 60 : 0;

  // 売り上げ確定日時: for a completed/pending booking this tracks close behind
  // 決済日時, but for a cancellation it's when the cancellation was actually
  // processed — which can land in a different month than the original
  // booking. Captured so 決済日ベース revenue can book that cancellation's
  // impact against the month it happened, not retroactively inside the
  // booking month.
  const confirmed = parseMonthDay(raw["売り上げ確定日時"]);
  const revenueConfirmedDate = confirmed
    ? `${resolveYear(confirmed.month, paymentISO)}-${String(confirmed.month).padStart(2, "0")}-${String(confirmed.day).padStart(2, "0")}`
    : null;

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
    booking_date: paymentISO.slice(0, 10),
    revenue_confirmed_date: revenueConfirmedDate,
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

function mapInstabaseStore(facilityName) {
  const hit = INSTABASE_FACILITY_STORE.find((f) => String(facilityName).includes(f.match));
  return hit ? hit.store : "Forest";
}

// Instabase's own "ステータス" column doesn't distinguish "already used" from
// "confirmed, usage date still ahead" the way 自社サイト's 状態="未確定" does
// — a future-dated booking shows the same "予約確定" as a past, completed one
// — so isFuture (derived from 利用開始日時 vs. today) is what decides that
// split here instead.
function mapInstabaseStatus(rawStatus, revenue, isFuture) {
  if (rawStatus === "予約確定") return isFuture ? PENDING_STATUS : "利用済み";
  if (rawStatus.includes("キャンセル")) return revenue > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  return null;
}

/**
 * Maps one row of a raw Instabase booking export (columns: 予約ID,施設名,
 * スペース名,ステータス,決済方法,決済状況,予約者ID,予約者会社名・屋号,予約者名,
 * 利用用途,用途詳細,利用人数,申込日時,利用開始日時,利用終了日時,利用時間 (時間),
 * 予約金額 (税込),支払金額 (税込)) to a transactions row, or null if the row
 * is unrecognized/unparseable. A "予約確定" row whose 利用開始日時 is still
 * ahead of today maps to PENDING_STATUS ("利用前", same treatment as
 * 自社サイト's 未確定 rows): counted in revenue, not in hours_used, and
 * updated in place (via external_id) once a later export reports it "利用済み".
 *
 * Revenue uses 予約金額 (税込) — the full listed booking price, which already
 * reflects any cancellation-fee tier — not 支払金額 (税込), which is net of
 * Instabase's platform commission; the existing historical data already
 * books the gross amount as revenue, treating the platform fee as a cost
 * rather than a discount off sales. This is populated at booking time
 * regardless of whether the usage date has passed yet, so no fallback
 * revenue computation is needed here the way 自社サイト's 決済元金+割引金額 was.
 */
export function mapRawInstabaseRow(raw) {
  const rawStatus = String(raw["ステータス"] || "").trim();
  const revenue = Number(raw["予約金額 (税込)"]) || 0;
  const date = String(raw["利用開始日時"] || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const isFuture = date > getTodayISO();
  const status = mapInstabaseStatus(rawStatus, revenue, isFuture);
  if (!status) return null;

  const startHour = Number(String(raw["利用開始日時"]).slice(11, 13));
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  const hoursUsed = status === "利用済み" ? Number(raw["利用時間 (時間)"]) || 0 : 0;

  return {
    date,
    store: mapInstabaseStore(raw["施設名"]),
    user_name: canonicalizeUserName(raw["予約者名"]),
    revenue,
    hours_used: hoursUsed,
    start_hour: Number.isNaN(startHour) ? null : startHour,
    weekday,
    channel: INSTABASE_CHANNEL,
    status,
    external_id: raw["予約ID"] || null,
    booking_date: String(raw["申込日時"] || "").slice(0, 10) || null,
  };
}
