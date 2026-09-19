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
const SPACEMARKET_CHANNEL = "スペースマーケット";

// スペース名 (listing/space name) substrings -> store. One 施設名 (facility/
// building) can host multiple スペース (rooms) that map to different stores —
// e.g. the "柏駅徒歩3分" facility lists both a Bellezza room and a separate
// Forest room — so matching has to key off スペース名, not 施設名.
const INSTABASE_SPACE_STORE = [
  { match: "柏唯一の年間ゴールドスペース", store: "Bellezza" },
  { match: "Bellezzaの2号店", store: "Forest" },
  { match: "はじめての一歩を応援する完全個室レンタルサロンAsteria", store: "Asteria" },
];

// Same idea for スペースマーケット, which uses its own listing titles for the
// same physical rooms — different wording from Instabase's, so it needs its
// own table rather than reusing INSTABASE_SPACE_STORE.
const SPACEMARKET_SPACE_STORE = [
  { match: "綺麗なサロンと評判の大人のレンタルサロン", store: "Bellezza" },
  { match: "Bellezza2号店", store: "Forest" },
  { match: "はじめての一歩を応援する完全個室レンタルサロンAsteria", store: "Asteria" },
  { match: "高級感ある完全個室サロン", store: "Asteria" },
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
  if (set.has("予約リクエスト日") && set.has("成約金額") && set.has("ゲスト名")) return "rawSpaceMarket";
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

  // The amount actually charged at booking time (決済元金+割引金額), captured
  // for every status — not just PENDING_STATUS, which is all `revenue` uses
  // it for elsewhere. For a completed booking this equals `revenue` (利益)
  // once finalized (see parseDiscountedAmount's comment), so it only
  // diverges from `revenue` for a cancellation, where `revenue` has since
  // been reduced to whatever was refunded/kept. That gap is exactly the
  // cancellation's impact, which the 決済日ベース aggregation books against
  // revenue_confirmed_date's month instead of leaving it baked into
  // booking_date's month.
  const bookingAmount = parseDiscountedAmount(raw);

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
    booking_amount: bookingAmount,
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

function mapInstabaseStore(spaceName) {
  const hit = INSTABASE_SPACE_STORE.find((f) => String(spaceName).includes(f.match));
  return hit ? hit.store : "Forest";
}

// Instabase's own "ステータス" column doesn't distinguish "already used" from
// "confirmed, usage date still ahead" the way 自社サイト's 状態="未確定" does
// — a future-dated booking shows the same "予約確定" as a past, completed one
// — so isFuture (derived from 利用開始日時 vs. today) is what decides that
// split here instead. Both of Instabase's own cancellation labels
// (利用者キャンセル, 特別キャンセル) always book as キャンセル(顧客) — unlike
// 自社サイト, this export doesn't carry enough detail to distinguish a
// refunded cancellation from one that wasn't.
function mapInstabaseStatus(rawStatus, isFuture) {
  if (rawStatus === "予約確定") return isFuture ? PENDING_STATUS : "利用済み";
  if (rawStatus.includes("キャンセル")) return "キャンセル(顧客)";
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
  const status = mapInstabaseStatus(rawStatus, isFuture);
  if (!status) return null;

  const startHour = Number(String(raw["利用開始日時"]).slice(11, 13));
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  const hoursUsed = status === "利用済み" ? Number(raw["利用時間 (時間)"]) || 0 : 0;

  return {
    date,
    store: mapInstabaseStore(raw["スペース名"]),
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

function mapSpaceMarketStore(spaceName) {
  const hit = SPACEMARKET_SPACE_STORE.find((f) => String(spaceName).includes(f.match));
  return hit ? hit.store : "Forest";
}

// "9/20/23" (M/D/YY) -> "2023-09-20".
function parseSpaceMarketDate(raw) {
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!m) return null;
  const month = m[1].padStart(2, "0");
  const day = m[2].padStart(2, "0");
  const year = 2000 + Number(m[3]);
  return `${year}-${month}-${day}`;
}

// "¥2,475" -> 2475.
function parseYen(raw) {
  const n = Number(String(raw).replace(/[¥,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Maps one row of a raw スペースマーケット sales-detail export (columns:
 * 対象月,元ファイル名,予約ID,予約リクエスト日,成約日,実施日,振込予定日,成約金額,
 * 振込予定金額,シェア設定,お支払い方法,施設名,スペース名,プラン名,ゲスト名,
 * 利用目的) to a transactions row, or null if the row is unrecognized/
 * unparseable. This export only lists closed deals (成約) — a cancelled
 * request never appears in it — so every row maps to 利用済み, unless 実施日
 * (usage date) is still ahead of today, in which case it's PENDING_STATUS
 * (same treatment as 自社サイト's 未確定 and Instabase's future-dated 予約確定
 * rows). There's no duration column in this export, so hours_used is always
 * 0 for this channel.
 */
export function mapRawSpaceMarketRow(raw) {
  const date = parseSpaceMarketDate(raw["実施日"]);
  if (!date) return null;

  const isFuture = date > getTodayISO();
  const status = isFuture ? PENDING_STATUS : "利用済み";
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];

  return {
    date,
    store: mapSpaceMarketStore(raw["スペース名"]),
    user_name: canonicalizeUserName(raw["ゲスト名"]),
    revenue: parseYen(raw["成約金額"]),
    hours_used: 0,
    start_hour: null,
    weekday,
    channel: SPACEMARKET_CHANNEL,
    status,
    external_id: raw["予約ID"] || null,
    booking_date: parseSpaceMarketDate(raw["予約リクエスト日"]),
  };
}
