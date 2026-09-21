import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, CHANNEL_COLOR, yen, formatDateShort } from "../../constants.js";
import BookingDateDetailModal from "../BookingDateDetailModal.jsx";
import UsageDateDetailModal from "../UsageDateDetailModal.jsx";

const BOOKING_COLOR = {
  予約: "#D4A644",
  取消: "#A84434",
  定額: CHANNEL_COLOR.定期クーポン,
  合計: "#D66B5C", // matches the plotted Line's stroke.
};

// 利用日ベースの一覧は「利用売上=通常予約の利用日ベース売上」の語彙(売上分析
// ページのMONTHLY_TREND_COLORと同じ色)に合わせる — 定額は同じ紫、合計に当たる
// 利用合売は売上分析の利用合売と同じ色。
const USAGE_COLOR = {
  利用: "#D4A644",
  定額: CHANNEL_COLOR.定期クーポン,
  合計: "#8F7D6E",
};

// The visible chart only plots count/cancelCount/subscriptionCount (stacked
// bars) and revenue=bookingRevenue+subscriptionRevenue-cancelRevenue (the
// line, "予約売上"). The tooltip additionally breaks the money out into
// 予売(bookingRevenue)→定売(subscriptionRevenue)→消売(cancelRevenue)→
// 合売(revenue、合計と同じ値) for transparency, so it reads straight off the
// day's raw datum (payload[0].payload) rather than the chart's own series
// list — that also sidesteps recharts' Tooltip listing series in
// registration order rather than JSX order. Passing an explicit `payload`
// prop to recharts' <Legend> did not reliably keep this order either — same
// registration-order quirk as Tooltip — so this renders the legend entirely
// by hand instead.
const BOOKING_LEGEND_ITEMS = [
  { label: "予約", color: BOOKING_COLOR.予約, shape: "square" },
  { label: "取消", color: BOOKING_COLOR.取消, shape: "square" },
  { label: "定額", color: BOOKING_COLOR.定額, shape: "square" },
  { label: "予約売上", color: BOOKING_COLOR.合計, shape: "line" },
];

const USAGE_LEGEND_ITEMS = [
  { label: "利用", color: USAGE_COLOR.利用, shape: "square" },
  { label: "定額", color: USAGE_COLOR.定額, shape: "square" },
  { label: "利用合売", color: USAGE_COLOR.合計, shape: "line" },
];

function TrendLegend({ items }) {
  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-2" style={{ fontSize: 12, color: "#262421" }}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          {item.shape === "line" ? (
            <span style={{ display: "inline-block", width: 14, height: 2, background: item.color }} />
          ) : (
            <span style={{ display: "inline-block", width: 10, height: 10, background: item.color }} />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function BookingTrendsTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const rows = [
    { key: "count", labelText: "予約", text: `${d.count}件`, color: BOOKING_COLOR.予約 },
    { key: "subscriptionCount", labelText: "定額", text: `${d.subscriptionCount}件`, color: BOOKING_COLOR.定額 },
    { key: "cancelCount", labelText: "取消", text: `${d.cancelCount}件`, color: BOOKING_COLOR.取消 },
    { key: "bookingRevenue", labelText: "予売", text: yen(d.bookingRevenue), color: BOOKING_COLOR.予約 },
    { key: "subscriptionRevenue", labelText: "定売", text: yen(d.subscriptionRevenue), color: BOOKING_COLOR.定額 },
    { key: "cancelRevenue", labelText: "消売", text: d.cancelRevenue > 0 ? `-${yen(d.cancelRevenue)}` : yen(0), color: BOOKING_COLOR.取消 },
    { key: "revenue", labelText: "合売", text: yen(d.revenue), color: BOOKING_COLOR.合計 },
  ];
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EDE3D5", padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#262421", fontWeight: 600, margin: "0 0 4px" }}>{formatDateShort(d.date)}</p>
      {rows.map((row) => (
        <p key={row.key} style={{ color: row.color, margin: 0 }}>
          {row.labelText}:{row.text}
        </p>
      ))}
    </div>
  );
}

function UsageTrendsTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const rows = [
    { key: "count", labelText: "利用", text: `${d.count}件`, color: USAGE_COLOR.利用 },
    { key: "subscriptionCount", labelText: "定額", text: `${d.subscriptionCount}件`, color: USAGE_COLOR.定額 },
    { key: "usageRevenue", labelText: "利用売", text: yen(d.usageRevenue), color: USAGE_COLOR.利用 },
    { key: "subscriptionRevenue", labelText: "定額売", text: yen(d.subscriptionRevenue), color: USAGE_COLOR.定額 },
    { key: "revenue", labelText: "合売", text: yen(d.revenue), color: USAGE_COLOR.合計 },
  ];
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EDE3D5", padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#262421", fontWeight: 600, margin: "0 0 4px" }}>{formatDateShort(d.date)}</p>
      {rows.map((row) => (
        <p key={row.key} style={{ color: row.color, margin: 0 }}>
          {row.labelText}:{row.text}
        </p>
      ))}
    </div>
  );
}

export default function DailyTrendsPage({ data }) {
  const [offset, setOffset] = useState(0);
  const [store, setStore] = useState("");
  const [usageDays, setUsageDays] = useState(null);
  const [bookingDays, setBookingDays] = useState(null);
  const [error, setError] = useState(null);
  const [selectedBookingDate, setSelectedBookingDate] = useState(null);
  const [selectedUsageDate, setSelectedUsageDate] = useState(null);

  useEffect(() => {
    setUsageDays(null);
    setBookingDays(null);
    setError(null);
    Promise.all([api.getUsageDaily(offset, store), api.getNewBookingsDaily(offset, store)])
      .then(([usageRes, bookingRes]) => {
        setUsageDays(usageRes.days);
        setBookingDays(bookingRes.days);
      })
      .catch((err) => setError(err.message));
  }, [offset, store]);

  const days = usageDays || bookingDays;
  const rangeLabel = days ? `${formatDateShort(days[0].date)}〜${formatDateShort(days[days.length - 1].date)}` : "";

  return (
    <div>
      <div className="mb-4">
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className="text-sm px-3 py-2 border"
          style={{ borderColor: "#EDE3D5", color: "#262421", background: "#FFFFFF" }}
        >
          <option value="">店舗(すべて)</option>
          {data?.storeNames?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-end mb-6 gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="p-1.5"
            style={{ color: "#8F7D6E", border: "1px solid #EDE3D5" }}
            aria-label="10日前へ"
            title="10日前へ"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            className="p-1.5"
            style={{ color: offset === 0 ? "#D8CDBE" : "#8F7D6E", border: "1px solid #EDE3D5", cursor: offset === 0 ? "default" : "pointer" }}
            aria-label="10日後へ"
            title="10日後へ"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm py-12 text-center" style={{ color: "#A84434" }}>
          {error}
        </p>
      )}

      {!error && !days && (
        <p className="text-sm py-12 text-center" style={{ color: "#8F7D6E" }}>
          読み込み中…
        </p>
      )}

      {!error && usageDays && (
        <div className="mb-12">
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            利用売上・利用件数(利用日ベース{rangeLabel ? `・${rangeLabel}` : ""})
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={usageDays.map((d) => ({ ...d, dayLabel: d.date.slice(-2) }))}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis
                  yAxisId="count"
                  tick={{ fill: "#8F7D6E", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v}件`}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fill: "#8F7D6E", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<UsageTrendsTooltip />} />
                <Legend content={<TrendLegend items={USAGE_LEGEND_ITEMS} />} />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  name="利用"
                  stackId="count"
                  fill={USAGE_COLOR.利用}
                  cursor="pointer"
                  onClick={(entry) => setSelectedUsageDate(entry.date)}
                />
                <Bar
                  yAxisId="count"
                  dataKey="subscriptionCount"
                  name="定額"
                  stackId="count"
                  fill={USAGE_COLOR.定額}
                  cursor="pointer"
                  onClick={(entry) => setSelectedUsageDate(entry.date)}
                />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="利用合売" stroke={USAGE_COLOR.合計} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            実際に利用した(または利用予定の)日です(予約を受け付けた日ではありません)。キャンセルされた予約は含みません。棒をクリックすると、その日の明細を表示します。
          </p>
        </div>
      )}

      {!error && bookingDays && (
        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            予約売上・予約件数(予約日ベース{rangeLabel ? `・${rangeLabel}` : ""})
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={bookingDays.map((d) => ({ ...d, dayLabel: d.date.slice(-2) }))}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis
                  yAxisId="count"
                  tick={{ fill: "#8F7D6E", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tickFormatter={(v) => `${v}件`}
                />
                <YAxis
                  yAxisId="revenue"
                  orientation="right"
                  tick={{ fill: "#8F7D6E", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<BookingTrendsTooltip />} />
                <Legend content={<TrendLegend items={BOOKING_LEGEND_ITEMS} />} />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  name="予約"
                  stackId="count"
                  fill={BOOKING_COLOR.予約}
                  cursor="pointer"
                  onClick={(entry) => setSelectedBookingDate(entry.date)}
                />
                <Bar
                  yAxisId="count"
                  dataKey="cancelCount"
                  name="取消"
                  stackId="count"
                  fill={BOOKING_COLOR.取消}
                  cursor="pointer"
                  onClick={(entry) => setSelectedBookingDate(entry.date)}
                />
                <Bar
                  yAxisId="count"
                  dataKey="subscriptionCount"
                  name="定額"
                  stackId="count"
                  fill={BOOKING_COLOR.定額}
                  cursor="pointer"
                  onClick={(entry) => setSelectedBookingDate(entry.date)}
                />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="予約売上" stroke={BOOKING_COLOR.合計} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            予約(または定期クーポン購入)が行われた日です(利用日ではありません)。予約売上は「予約+定額クーポンの売上」からキャンセル代(自社サイトの本来の予約金額とキャンセル後に実際に残った売上の差額)を差し引いた金額です。棒をクリックすると、その日の明細を表示します。
          </p>
        </div>
      )}

      <UsageDateDetailModal date={selectedUsageDate} store={store} storeMeta={data?.storeMeta} onClose={() => setSelectedUsageDate(null)} />
      <BookingDateDetailModal date={selectedBookingDate} store={store} storeMeta={data?.storeMeta} onClose={() => setSelectedBookingDate(null)} />
    </div>
  );
}
