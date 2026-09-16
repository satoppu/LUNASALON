// Shared CSV row normalization for both the initial seed and the /api/import
// endpoint. Column names are matched loosely (English/Japanese, camel/snake)
// so exports from the reservation system or the dashboard's own template both work.

const HEADER_ALIASES = {
  date: ["日付", "date"],
  store: ["店舗", "store"],
  user: ["利用者", "user", "customer", "顧客", "氏名"],
  revenue: ["売上", "revenue", "金額"],
  hoursUsed: ["利用時間", "hoursUsed", "hours_used"],
  hour: ["hour", "開始時間", "start_hour"],
  weekday: ["weekday", "曜日"],
  channel: ["channel", "導線", "チャネル"],
  status: ["status", "ステータス"],
};

function matchHeader(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return undefined;
}

const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];

/**
 * Normalizes one parsed CSV row into a transactions row, or returns null if
 * the row is unusable (missing date/store or a non-numeric revenue).
 *
 * Status is trusted when the CSV supplies it explicitly; otherwise it is
 * inferred from revenue/hoursUsed per spec 4.2/4.3 so older exports (which
 * only carry the already-computed revenue/hoursUsed columns) still land in
 * the right bucket for server-side aggregation.
 */
export function normalizeImportRow(raw) {
  const date = matchHeader(raw, HEADER_ALIASES.date);
  const store = matchHeader(raw, HEADER_ALIASES.store);
  const revenueRaw = matchHeader(raw, HEADER_ALIASES.revenue);
  const revenue = Number(revenueRaw);
  if (!date || !store || revenueRaw === undefined || Number.isNaN(revenue)) return null;

  const dateStr = String(date).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const hoursUsedRaw = matchHeader(raw, HEADER_ALIASES.hoursUsed);
  const hoursUsed = Number(hoursUsedRaw);

  const hourRaw = matchHeader(raw, HEADER_ALIASES.hour);
  const hour = hourRaw !== undefined ? Number(hourRaw) : null;

  let weekday = matchHeader(raw, HEADER_ALIASES.weekday);
  if (!weekday) {
    const d = new Date(dateStr);
    weekday = Number.isNaN(d.getTime()) ? null : WEEKDAY_FROM_JS_DOW[d.getDay()];
  }

  const channel = matchHeader(raw, HEADER_ALIASES.channel) || "自社サイト";

  const hoursUsedSafe = Number.isNaN(hoursUsed) ? 0 : hoursUsed;
  let status = matchHeader(raw, HEADER_ALIASES.status);
  if (!status) {
    if (hoursUsedSafe > 0) status = "利用済み";
    else if (revenue > 0) status = "キャンセル(返金あり)";
    else status = "キャンセル(顧客)";
  }

  return {
    date: dateStr,
    store: String(store).trim(),
    user_name: matchHeader(raw, HEADER_ALIASES.user)?.toString().trim() || "不明",
    revenue,
    hours_used: hoursUsedSafe,
    start_hour: hour === null || Number.isNaN(hour) ? null : hour,
    weekday: weekday || null,
    channel: String(channel).trim(),
    status: String(status).trim(),
  };
}
