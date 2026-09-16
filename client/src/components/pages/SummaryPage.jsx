import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function SummaryPage({ data }) {
  const { year, storeNames, storeMeta, summary, occupancyData, overallStats, annualTrend } = data;
  const storeColor = makeStoreColor(storeMeta);

  return (
    <>
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度別売上推移(全期間)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={annualTrend}>
              <CartesianGrid stroke="#EFEAE3" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} tickFormatter={(v) => `${v}年`} />
              <YAxis tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(v) => yen(v)} labelFormatter={(v) => `${v}年`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {storeNames.map((name) => (
                <Bar key={name} dataKey={name} stackId="revenue" fill={storeColor(name)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-10 gap-y-3 mb-10 px-6 py-4" style={{ background: "#FFFFFF" }}>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-2xl font-bold">
            {overallStats.avgOccupancy.toFixed(1)}%
          </p>
          <p style={{ color: "#8A857D" }} className="text-xs">
            全店舗 平均稼働率
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-2xl font-bold">
            {overallStats.avgHoursPerUse.toFixed(1)}h
          </p>
          <p style={{ color: "#8A857D" }} className="text-xs">
            平均利用時間 / 件
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-2xl font-bold">
            {overallStats.totalUses}
          </p>
          <p style={{ color: "#8A857D" }} className="text-xs">
            利用件数({year}年)
          </p>
        </div>
        <div>
          <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-2xl font-bold">
            {overallStats.uniqueUsers}
          </p>
          <p style={{ color: "#8A857D" }} className="text-xs">
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
                  <span style={{ color: "#8A857D" }} className="text-xs">
                    {meta.area}
                  </span>
                )}
              </div>
              <p style={{ fontFamily: FONT_HEAD, color }} className="text-3xl font-bold mb-1">
                {yen(s.revenue)}
              </p>
              <p style={{ color: "#8A857D" }} className="text-xs mb-4">
                {year}年 累計売上
              </p>
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {(availableHours?.["稼働率"] ?? 0).toFixed(1)}%
                  </p>
                  <p style={{ color: "#8A857D" }} className="text-xs">
                    稼働率
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.count > 0 ? (s.hoursUsed / s.count).toFixed(1) : "0.0"}h
                  </p>
                  <p style={{ color: "#8A857D" }} className="text-xs">
                    平均利用時間
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.hoursUsed.toFixed(1)}h
                  </p>
                  <p style={{ color: "#8A857D" }} className="text-xs">
                    総利用時間
                  </p>
                </div>
                <div>
                  <p style={{ color: "#262421" }} className="font-medium">
                    {s.count}
                  </p>
                  <p style={{ color: "#8A857D" }} className="text-xs">
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
