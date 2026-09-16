import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function RevenuePage({ data }) {
  const { year, priorYear, hasPriorYear, priorYear2, hasPriorYear2, storeMeta, monthlyTrend, yoyMonthly, yoyMonthlyCount, yoyByStore } =
    data;
  const storeColor = makeStoreColor(storeMeta);
  const yoyLabel = [year, hasPriorYear && priorYear, hasPriorYear2 && priorYear2]
    .filter(Boolean)
    .map((y) => `${y}年`)
    .join(" vs ");

  return (
    <>
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          売上推移({year}年・月別・通常予約 / 定期クーポン)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid stroke="#F0E3E7" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={{ stroke: "#EAE0E3" }} tickLine={false} />
              <YAxis
                tick={{ fill: "#8F7B82", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v) => yen(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="通常予約" stackId="revenue" fill="#B5306A" />
              <Bar dataKey="定期クーポン" stackId="revenue" fill={CHANNEL_COLOR["定期クーポン"]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度比較(売上) — {yoyLabel}
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4 mb-4">
          {hasPriorYear ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yoyMonthly}>
                <CartesianGrid stroke="#F0E3E7" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={{ stroke: "#EAE0E3" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => yen(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey={`${year}年`} stroke="#B5306A" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey={`${priorYear}年`} stroke="#BD6F4E" strokeWidth={2.5} strokeDasharray="4 3" dot={false} connectNulls />
                {hasPriorYear2 && (
                  <Line type="monotone" dataKey={`${priorYear2}年`} stroke="#5D3C8C" strokeWidth={2.5} strokeDasharray="2 2" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7B82" }} className="text-sm py-8 text-center">
              {priorYear}年のデータがないため比較できません。
            </p>
          )}
        </div>

        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度比較(利用件数) — {yoyLabel}
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4 mb-4">
          {hasPriorYear ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yoyMonthlyCount}>
                <CartesianGrid stroke="#F0E3E7" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={{ stroke: "#EAE0E3" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}件`} />
                <Tooltip formatter={(v) => `${v}件`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey={`${year}年`} stroke="#B5306A" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey={`${priorYear}年`} stroke="#BD6F4E" strokeWidth={2.5} strokeDasharray="4 3" dot={false} connectNulls />
                {hasPriorYear2 && (
                  <Line type="monotone" dataKey={`${priorYear2}年`} stroke="#5D3C8C" strokeWidth={2.5} strokeDasharray="2 2" dot={false} connectNulls />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7B82" }} className="text-sm py-8 text-center">
              {priorYear}年のデータがないため比較できません。
            </p>
          )}
        </div>

        {yoyByStore.length > 0 && (
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #EAE0E3" }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    店舗
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    対象月
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    {year}年 売上
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    {priorYear}年同月 売上
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                    前年同月比
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyByStore.map((y) => (
                  <tr key={y.store} style={{ borderBottom: "1px solid #F3E7EA" }}>
                    <td className="px-4 py-3">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(y.store) }} />
                      {y.store}
                    </td>
                    <td className="px-4 py-3">{y.latestMonth}月</td>
                    <td className="px-4 py-3 text-right">{yen(y.curRevenue)}</td>
                    <td className="px-4 py-3 text-right">{y.hasPrev ? yen(y.prevRevenue) : "—"}</td>
                    <td className="px-4 py-3 text-right" style={{ color: y.pct == null ? "#8F7B82" : y.pct >= 0 ? "#B5306A" : "#BD6F4E" }}>
                      {y.pct == null ? "前年データなし" : `${y.pct >= 0 ? "+" : ""}${y.pct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
