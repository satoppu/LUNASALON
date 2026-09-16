import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { CHANNELS, CHANNEL_COLOR, FONT_HEAD, yen } from "../constants.js";

export default function Dashboard({ data }) {
  const {
    year,
    priorYear,
    hasPriorYear,
    storeNames,
    storeMeta,
    summary,
    monthlyTrend,
    occupancyData,
    hourlyUsage,
    weekdayOccupancy,
    channelSummary,
    channelByStore,
    recentRows,
    overallStats,
    userSummary,
    yoyMonthly,
    yoyByStore,
  } = data;

  const storeColor = (name) => storeMeta?.[name]?.color || "#8A857D";

  return (
    <>
      {/* Overall stats strip */}
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

      {/* Store summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
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

      {/* Monthly trend & occupancy */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-12">
        <div className="lg:col-span-3">
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            店舗別売上推移({year}年・月別)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid stroke="#EFEAE3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} />
                <YAxis
                  tick={{ fill: "#8A857D", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => yen(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={storeColor(name)} strokeWidth={2.5} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            稼働率比較({year}年)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={occupancyData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="#EFEAE3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="store" tick={{ fill: "#262421", fontSize: 13 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="稼働率" radius={[0, 2, 2, 0]}>
                  {occupancyData.map((d) => (
                    <Bar key={d.store} dataKey="稼働率" fill={storeColor(d.store)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Time-of-day & weekday */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            利用時間帯({year}年・開始時刻別の利用時間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyUsage}>
                <CartesianGrid stroke="#EFEAE3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#8A857D", fontSize: 11 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} interval={1} />
                <YAxis tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name) => (
                  <Bar key={name} dataKey={name} stackId="hours" fill={storeColor(name)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            曜日別稼働率({year}年)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekdayOccupancy}>
                <CartesianGrid stroke="#EFEAE3" vertical={false} />
                <XAxis dataKey="weekday" tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} />
                <YAxis tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name) => (
                  <Bar key={name} dataKey={name} fill={storeColor(name)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Channel (導線) analysis */}
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          導線別売上({year}年・集客チャネル)
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-2" style={{ background: "#FFFFFF" }}>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={channelSummary} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid stroke="#EFEAE3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#8A857D", fontSize: 11 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="channel" tick={{ fill: "#262421", fontSize: 12 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip formatter={(v) => yen(v)} />
                  <Bar dataKey="revenue" radius={[0, 2, 2, 0]}>
                    {channelSummary.map((d) => (
                      <Bar key={d.channel} dataKey="revenue" fill={CHANNEL_COLOR[d.channel] || "#8A857D"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="lg:col-span-3 overflow-x-auto" style={{ background: "#FFFFFF" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    店舗
                  </th>
                  {CHANNELS.map((c) => (
                    <th key={c} className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                      {c}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    合計
                  </th>
                </tr>
              </thead>
              <tbody>
                {channelByStore.map((row) => (
                  <tr key={row.store} style={{ borderBottom: "1px solid #F1EDE7" }}>
                    <td className="px-4 py-3">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(row.store) }} />
                      {row.store}
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c} className="px-4 py-3 text-right">
                        {row.total > 0 ? `${Math.round((row[c] / row.total) * 100)}%` : "—"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-medium">{yen(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs" style={{ color: "#8A857D" }}>
              各セルは店舗ごとの売上構成比。
            </p>
          </div>
        </div>
      </div>

      {/* Year-over-year comparison */}
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度比較 — {year}年 vs {priorYear}年
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4 mb-4">
          {hasPriorYear ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={yoyMonthly}>
                <CartesianGrid stroke="#EFEAE3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={{ stroke: "#E7E2DB" }} tickLine={false} />
                <YAxis tick={{ fill: "#8A857D", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => yen(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey={`${year}年`} stroke="#345953" strokeWidth={2.5} dot={false} connectNulls />
                <Line type="monotone" dataKey={`${priorYear}年`} stroke="#B66E7D" strokeWidth={2.5} strokeDasharray="4 3" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8A857D" }} className="text-sm py-8 text-center">
              {priorYear}年のデータがないため比較できません。
            </p>
          )}
        </div>

        {yoyByStore.length > 0 && (
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    店舗
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    対象月
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    {year}年 売上
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    {priorYear}年同月 売上
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    前年同月比
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyByStore.map((y) => (
                  <tr key={y.store} style={{ borderBottom: "1px solid #F1EDE7" }}>
                    <td className="px-4 py-3">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(y.store) }} />
                      {y.store}
                    </td>
                    <td className="px-4 py-3">{y.latestMonth}月</td>
                    <td className="px-4 py-3 text-right">{yen(y.curRevenue)}</td>
                    <td className="px-4 py-3 text-right">{y.hasPrev ? yen(y.prevRevenue) : "—"}</td>
                    <td className="px-4 py-3 text-right" style={{ color: y.pct == null ? "#8A857D" : y.pct >= 0 ? "#345953" : "#B66E7D" }}>
                      {y.pct == null ? "前年データなし" : `${y.pct >= 0 ? "+" : ""}${y.pct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top 10 users */}
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          利用者別 売上トップ10({year}年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  順位
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  利用者
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  主な店舗
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  利用回数
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  総利用時間
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  平均利用時間
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  総売上
                </th>
              </tr>
            </thead>
            <tbody>
              {userSummary.map((u, i) => (
                <tr key={u.user} style={{ borderBottom: "1px solid #F1EDE7" }}>
                  <td className="px-4 py-3" style={{ fontFamily: FONT_HEAD, color: "#345953" }}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3">{u.user}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(u.mainStore) }} />
                    {u.mainStore}
                  </td>
                  <td className="px-4 py-3 text-right">{u.count}</td>
                  <td className="px-4 py-3 text-right">{u.hoursUsed.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right">{u.avgHours.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right font-medium">{yen(u.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent usage */}
      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          直近の利用実績({year}年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  日付
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  店舗
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  利用者
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  導線
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  売上
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                  利用時間
                </th>
              </tr>
            </thead>
            <tbody>
              {recentRows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #F1EDE7" }}>
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(r.store) }} />
                    {r.store}
                  </td>
                  <td className="px-4 py-3">{r.user_name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5" style={{ background: "#F1EDE7", color: CHANNEL_COLOR[r.channel] || "#6B665F" }}>
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{yen(r.revenue)}</td>
                  <td className="px-4 py-3 text-right">{r.hours_used.toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
