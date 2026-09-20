import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, CHANNEL_COLOR, yen, formatDateShort } from "../../constants.js";
import BookingDateDetailModal from "../BookingDateDetailModal.jsx";

export default function DailyTrendsPage({ data }) {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    api
      .getNewBookingsDaily()
      .then((res) => setDays(res.days))
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }

  if (!days) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "#8F7D6E" }}>
        読み込み中…
      </p>
    );
  }

  const chartData = days.map((d) => ({ ...d, label: formatDateShort(d.date) }));

  return (
    <div>
      <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
        予約受付件数・売上(予約日ベース・直近10日間)
      </h3>
      <div style={{ background: "#FFFFFF" }} className="p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid stroke="#F0E6D8" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
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
            <Tooltip formatter={(v, name) => (name === "売上" ? yen(v) : `${v}件`)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="count"
              dataKey="count"
              name="予約"
              stackId="count"
              fill="#D4A644"
              cursor="pointer"
              onClick={(entry) => setSelectedDate(entry.date)}
            />
            <Bar
              yAxisId="count"
              dataKey="subscriptionCount"
              name="定期クーポン"
              stackId="count"
              fill={CHANNEL_COLOR.定期クーポン}
              cursor="pointer"
              onClick={(entry) => setSelectedDate(entry.date)}
            />
            <Line yAxisId="revenue" type="monotone" dataKey="revenue" name="売上" stroke="#D66B5C" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
        予約(または定期クーポン購入)が行われた日ベースです(利用日ではありません)。売上は他の集計と同じ実効売上ルールに基づきます。棒をクリックすると、その日の明細を表示します。
      </p>

      <BookingDateDetailModal date={selectedDate} storeMeta={data?.storeMeta} onClose={() => setSelectedDate(null)} />
    </div>
  );
}
