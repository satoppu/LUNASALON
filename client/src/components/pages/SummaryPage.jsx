import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function SummaryPage({ data }) {
  const { year, storeNames, storeMeta, summary, occupancyData, overallStats, annualTrend } = data;
  const storeColor = makeStoreColor(storeMeta);
  const yearTotals = annualTrend.map((y) => ({
    year: y.year,
    total: storeNames.reduce((s, name) => s + (y[name] || 0), 0),
  }));
  const totalRevenue = yearTotals.reduce((sum, y) => sum + y.total, 0);

  return (
    <>
      <div className="mb-12">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
            年度別売上推移(全期間)
          </h3>
          <p style={{ fontFamily: FONT_HEAD, color: "#B5306A" }} className="text-sm">
            全期間累計売上:{" "}
            <span className="text-2xl font-bold">{yen(totalRevenue)}</span>
          </p>
        </div>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={annualTrend}>
              <CartesianGrid stroke="#F0E3E7" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={{ stroke: "#EAE0E3" }} tickLine={false} tickFormatter={(v) => `${v}年`} />
              <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(v) => yen(v)} labelFormatter={(v) => `${v}年`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {storeNames.map((name) => (
                <Bar key={name} dataKey={name} stackId="revenue" fill={storeColor(name)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #EAE0E3" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  年度
                </th>
                {storeNames.map((name) => (
                  <th key={name} className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    {name}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  合計
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  前年比
                </th>
              </tr>
            </thead>
            <tbody>
              {annualTrend.map((y, i) => {
                const total = yearTotals[i].total;
                const prevTotal = i > 0 ? yearTotals[i - 1].total : null;
                const pct = prevTotal != null && prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
                return (
                  <tr key={y.year} style={{ borderBottom: "1px solid #F3E7EA" }}>
                    <td className="px-4 py-3">{y.year}年</td>
                    {storeNames.map((name) => (
                      <td key={name} className="px-4 py-3 text-right">
                        {yen(y[name] || 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium">{yen(total)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: pct == null ? "#8F7B82" : pct >= 0 ? "#B5306A" : "#BD6F4E" }}>
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-3 mb-10 px-6 py-4" style={{ background: "#FFFFFF" }}>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#B5306A" }} className="text-2xl font-bold">
            {overallStats.avgOccupancy.toFixed(1)}%
          </p>
          <p style={{ color: "#8F7B82" }} className="text-xs">
            全店舗 平均稼働率
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#B5306A" }} className="text-2xl font-bold">
            {overallStats.avgHoursPerUse.toFixed(1)}h
          </p>
          <p style={{ color: "#8F7B82" }} className="text-xs">
            平均利用時間 / 件
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#B5306A" }} className="text-2xl font-bold">
            {overallStats.totalUses}
          </p>
          <p style={{ color: "#8F7B82" }} className="text-xs">
            利用件数({year}年)
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#B5306A" }} className="text-2xl font-bold">
            {overallStats.uniqueUsers}
          </p>
          <p style={{ color: "#8F7B82" }} className="text-xs">
            利用者数({year}年)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {storeNames.map((name) => {
          const s = summary[name] || { revenue: 0, hoursUsed: 0, count: 0 };
          const color = storeColor(name);
          const meta = storeMeta?.[name];
          const availableHours = occupancyData.find((o) => o.store === name);
          return (
            <div key={name} style={{ background: "#FFFFFF", borderLeft: `4px solid ${color}` }} className="px-6 py-5">
              <div className="flex items-baseline justify-between mb-3">
                <h2 style={{ fontFamily: FONT_HEAD }} className="text-lg font-bold">
                  {name}
                </h2>
                {meta?.area && (
                  <span style={{ color: "#8F7B82" }} className="text-xs">
                    {meta.area}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: FONT_HEAD, color }} className="text-3xl font-bold mb-1">
                {yen(s.revenue)}
              </p>
              <p style={{ color: "#8F7B82" }} className="text-xs mb-4">
                {year}年 累計売上
              </p>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {(availableHours?.["稼働率"] ?? 0).toFixed(1)}%
                  </p>
                  <p style={{ color: "#8F7B82" }} className="text-xs">
                    稼働率
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.count > 0 ? (s.hoursUsed / s.count).toFixed(1) : "0.0"}h
                  </p>
                  <p style={{ color: "#8F7B82" }} className="text-xs">
                    平均利用時間
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.hoursUsed.toFixed(1)}h
                  </p>
                  <p style={{ color: "#8F7B82" }} className="text-xs">
                    総利用時間
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.count}
                  </p>
                  <p style={{ color: "#8F7B82" }} className="text-xs">
                    利用件数
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
