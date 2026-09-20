import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, CHANNEL_COLOR, yen, formatDateShort } from "../../constants.js";
import BookingDateDetailModal from "../BookingDateDetailModal.jsx";

const COLOR = {
  予約: "#D4A644",
  取消: "#A84434",
  定額: CHANNEL_COLOR.定期クーポン,
  売上: "#8F7D6E", // grossRevenue subtotal — informational only, not its own bar/line.
  合計: "#D66B5C", // matches the plotted Line's stroke.
};

// The visible chart only plots count/cancelCount/subscriptionCount (stacked
// bars) and revenue=grossRevenue-cancelRevenue (the line, "合計"). The
// tooltip additionally breaks the money out into 売上(粗)→取消(差引)→合計
// for transparency, so it reads straight off the day's raw datum
// (payload[0].payload) rather than the chart's own series list — that also
// sidesteps recharts' Tooltip listing series in registration order rather
// than JSX order, and lets 取消 appear twice (件数・金額) unambiguously.
// Passing an explicit `payload` prop to recharts' <Legend> did not reliably
// keep this order either — same registration-order quirk as Tooltip — so
// this renders the legend entirely by hand instead.
const LEGEND_ITEMS = [
  { label: "予約", color: COLOR.予約, shape: "square" },
  { label: "取消", color: COLOR.取消, shape: "square" },
  { label: "定額", color: COLOR.定額, shape: "square" },
  { label: "合計", color: COLOR.合計, shape: "line" },
];

function DailyTrendsLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-2" style={{ fontSize: 12, color: "#262421" }}>
      {LEGEND_ITEMS.map((item) => (
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

function DailyTrendsTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const rows = [
    { key: "count", labelText: "予約", text: `${d.count}件`, color: COLOR.予約 },
    { key: "cancelCount", labelText: "取消", text: `${d.cancelCount}件`, color: COLOR.取消 },
    { key: "subscriptionCount", labelText: "定額", text: `${d.subscriptionCount}件`, color: COLOR.定額 },
    { key: "grossRevenue", labelText: "売上", text: yen(d.grossRevenue), color: COLOR.売上 },
    { key: "cancelRevenue", labelText: "取消", text: d.cancelRevenue > 0 ? `-${yen(d.cancelRevenue)}` : yen(0), color: COLOR.取消 },
    { key: "revenue", labelText: "合計", text: yen(d.revenue), color: COLOR.合計 },
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
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    setDays(null);
    setError(null);
    api
      .getNewBookingsDaily(offset)
      .then((res) => setDays(res.days))
      .catch((err) => setError(err.message));
  }, [offset]);

  const rangeLabel = days ? `${formatDateShort(days[0].date)}〜${formatDateShort(days[days.length - 1].date)}` : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
          予約受付件数・売上(予約日ベース{rangeLabel ? `・${rangeLabel}` : ""})
        </h3>
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

      {!error && days && (
        <>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={days.map((d) => ({ ...d, dayLabel: d.date.slice(-2) }))}>
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
                <Tooltip content={<DailyTrendsTooltip />} />
                <Legend content={<DailyTrendsLegend />} />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  name="予約"
                  stackId="count"
                  fill={COLOR.予約}
                  cursor="pointer"
                  onClick={(entry) => setSelectedDate(entry.date)}
                />
                <Bar
                  yAxisId="count"
                  dataKey="cancelCount"
                  name="取消"
                  stackId="count"
                  fill={COLOR.取消}
                  cursor="pointer"
                  onClick={(entry) => setSelectedDate(entry.date)}
                />
                <Bar
                  yAxisId="count"
                  dataKey="subscriptionCount"
                  name="定額"
                  stackId="count"
                  fill={COLOR.定額}
                  cursor="pointer"
                  onClick={(entry) => setSelectedDate(entry.date)}
                />
                <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="合計" stroke={COLOR.合計} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            予約(または定期クーポン購入)が行われた日ベースです(利用日ではありません)。合計は「予約+定額クーポンの売上」からキャンセル代(自社サイトの本来の予約金額とキャンセル後に実際に残った売上の差額)を差し引いた金額です。棒をクリックすると、その日の明細を表示します。
          </p>
        </>
      )}

      <BookingDateDetailModal date={selectedDate} storeMeta={data?.storeMeta} onClose={() => setSelectedDate(null)} />
    </div>
  );
}
