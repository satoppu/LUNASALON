// Business rules (spec section 4). Defaults only — persisted, overridable values
// live in the store_settings table so nothing here needs to be hardcoded per store.

export const DEFAULT_OPERATING_HOURS_PER_DAY = 14;

export const DEFAULT_STORES = [
  { store: "Bellezza", area: "柏", color: "#345953", sortOrder: 0 },
  { store: "Forest", area: "柏", color: "#7C8F4A", sortOrder: 1 },
  { store: "Asteria", area: "つくば", color: "#5E6FA0", sortOrder: 2 },
];

export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#262421",
  Instabase: "#3B6FA0",
  スペースマーケット: "#4E8F5B",
  その他: "#B0A99A",
};

// 月=0 .. 日=6, matches the WEEKDAYS order used throughout the app.
export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

// JS Date#getDay(): 日=0 .. 土=6
export const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];

export const MONTH_LABELS = [
  "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月",
];

// Rows counted as revenue per spec 4.2. "定期クーポン" (subscription income) is
// intentionally excluded — it isn't tied to a single store.
export const REVENUE_STATUSES = new Set(["利用済み", "キャンセル(返金あり)"]);

// Rows counted as actual room usage per spec 4.3 — cancellations never occupy the room.
export const HOURS_USED_STATUSES = new Set(["利用済み"]);

/** Today's date in JST as YYYY-MM-DD, computed dynamically per spec 4.4/7.3 (never hardcoded). */
export function getTodayISO() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
}
