// Business rules (spec section 4). Defaults only — persisted, overridable values
// live in the store_settings table so nothing here needs to be hardcoded per store.

export const DEFAULT_OPERATING_HOURS_PER_DAY = 14;

export const DEFAULT_STORES = [
  { store: "Bellezza", area: "柏", color: "#D9738F", sortOrder: 0 },
  { store: "Forest", area: "柏", color: "#D4A644", sortOrder: 1 },
  { store: "Asteria", area: "つくば", color: "#D66B5C", sortOrder: 2 },
];

export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#D9738F",
  Instabase: "#D4A644",
  スペースマーケット: "#D66B5C",
  その他: "#8F4A28",
  定期クーポン: "#D9738F",
};

// Status for 定期利用/サブスクリプション revenue rows. Unlike the four channels
// above, this isn't a booking channel — it's revenue linked to whichever store
// the subscriber uses most (resolved at import time), so it's tracked via
// `status` and excluded from the channel-breakdown charts, not bucketed as "その他".
export const SUBSCRIPTION_STATUS = "定期クーポン";

// Status for a 自社サイト booking whose usage date hasn't happened yet (raw
// export status "未確定", shown as "利用前" in the platform's own UI). It's a
// confirmed/paid reservation, so it counts toward revenue, but the room
// hasn't actually been used yet, so it's excluded from hours/occupancy. Once
// the date passes, a later export reports it as "利用済み" instead (see
// rawImportMappers.js), and the upsert-on-external_id import logic updates
// the existing row in place rather than adding a duplicate.
export const PENDING_STATUS = "利用前";

// 月=0 .. 日=6, matches the WEEKDAYS order used throughout the app.
export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

// JS Date#getDay(): 日=0 .. 土=6
export const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];

export const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月",
];

// Rows counted as revenue per spec 4.2, plus 定期クーポン (subscription income),
// which is now linked to a store via the subscriber's most-used store (see
// server/src/importSubscriptions.js) rather than excluded outright.
export const REVENUE_STATUSES = new Set(["利用済み", "キャンセル(返金あり)", SUBSCRIPTION_STATUS, PENDING_STATUS]);

// Rows counted as actual room usage per spec 4.3 — cancellations never occupy the room.
export const HOURS_USED_STATUSES = new Set(["利用済み"]);

/** Today's date in JST as YYYY-MM-DD, computed dynamically per spec 4.4/7.3 (never hardcoded). */
export function getTodayISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}
