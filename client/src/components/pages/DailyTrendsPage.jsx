import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, yen, formatDateShort } from "../../constants.js";

const CHART_STYLE = { background: "#FFFFFF" };

function DailyBarChart({ data, dataKey, name, color, tickFormatter, tooltipFormatter }) {
  return (
    <div style={CHART_STYLE} className="p-4">
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid stroke="#F0E6D8" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
          <YAxis
            tick={{ fill: "#8F7D6E", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickFormatter={tickFormatter}
          />
          <Tooltip formatter={tooltipFormatter} />
          <Bar dataKey={dataKey} name={name} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DailyTrendsPage() {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getDailyTrends()
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
    <>
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          新規予約件数(直近10日間)
        </h3>
        <DailyBarChart
          data={chartData}
          dataKey="newBookings"
          name="新規予約件数"
          color="#D4A644"
          tickFormatter={(v) => `${v}件`}
          tooltipFormatter={(v) => `${v}件`}
        />
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          その日に予約が入った件数です(決済日/申込日ベース。ステータスは問わず、後でキャンセルになったものも含みます)。
        </p>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          キャンセル件数(直近10日間)
        </h3>
        <DailyBarChart
          data={chartData}
          dataKey="cancellations"
          name="キャンセル件数"
          color="#D66B5C"
          tickFormatter={(v) => `${v}件`}
          tooltipFormatter={(v) => `${v}件`}
        />
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          その日にキャンセルが確認された件数です。毎朝の自動取り込みが検知した日を記録する仕組みのため、この集計が始まる前の日は実際にキャンセルがあっても0件と表示されます。
        </p>
      </div>

      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          日別売上(直近10日間)
        </h3>
        <DailyBarChart
          data={chartData}
          dataKey="revenue"
          name="売上"
          color="#D9738F"
          tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
          tooltipFormatter={(v) => yen(v)}
        />
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          利用日ベースの合計売上です(全店舗・全チャネル)。
        </p>
      </div>
    </>
  );
}
