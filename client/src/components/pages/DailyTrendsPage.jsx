import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, formatDateShort } from "../../constants.js";

export default function DailyTrendsPage() {
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);

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
        新規予約件数(直近10日間)
      </h3>
      <div style={{ background: "#FFFFFF" }} className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid stroke="#F0E6D8" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
            <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => `${v}件`} />
            <Tooltip formatter={(v) => `${v}件`} />
            <Bar dataKey="count" name="新規予約件数" fill="#D4A644" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
        その日に予約が入った件数です(決済日/申込日ベース。ステータスは問わず、後でキャンセルになったものも含みます)。
      </p>
    </div>
  );
}
