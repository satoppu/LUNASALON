import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { FONT_HEAD, makeStoreColor } from "../../constants.js";

// 前年バーは店舗色ではなく、どの店舗でも同じ控えめなグレーで統一 — 「今年の
// 実データ」と「前年の参考値」を色でも区別できるようにする。
const PRIOR_YEAR_COLOR = "#D8CDBB";

export default function OccupancyPage({ data }) {
  const {
    year,
    priorYear,
    hasPriorYear,
    storeNames,
    storeMeta,
    occupancyData,
    priorYearSummary,
    hourlyUsage,
    priorYearHourlyUsage,
    weekdayOccupancy,
    priorYearWeekdayOccupancy,
  } = data;
  const storeColor = makeStoreColor(storeMeta);

  const occupancyCompare = occupancyData.map((o) => ({
    ...o,
    前年稼働率: hasPriorYear ? priorYearSummary?.[o.store]?.occupancy ?? 0 : undefined,
  }));

  const hourlyCompare =
    hasPriorYear && priorYearHourlyUsage?.length > 0
      ? hourlyUsage.map((b, i) => ({ hour: b.hour, 今年: Math.round(b.total * 10) / 10, 前年: priorYearHourlyUsage[i]?.total ?? 0 }))
      : [];

  const weekdayCompare =
    hasPriorYear && priorYearWeekdayOccupancy?.length > 0
      ? weekdayOccupancy.map((w, i) => ({ weekday: w.weekday, 今年: w.合計, 前年: priorYearWeekdayOccupancy[i]?.合計 ?? 0 }))
      : [];

  return (
    <>
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          稼働率比較({year}年{hasPriorYear ? `・前年${priorYear}年比較` : ""})
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={occupancyCompare} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke="#F0E6D8" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="store" tick={{ fill: "#262421", fontSize: 13 }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(v) => `${v}%`} />
              {hasPriorYear && <Legend wrapperStyle={{ fontSize: 12 }} />}
              <Bar dataKey="稼働率" name={`${year}年`} radius={[0, 2, 2, 0]}>
                {occupancyCompare.map((d) => (
                  <Cell key={d.store} fill={storeColor(d.store)} />
                ))}
              </Bar>
              {hasPriorYear && <Bar dataKey="前年稼働率" name={`${priorYear}年`} fill={PRIOR_YEAR_COLOR} radius={[0, 2, 2, 0]} />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            利用時間帯({year}年・開始時刻別の利用時間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyUsage}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: "#8F7D6E", fontSize: 11 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} interval={1} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name) => (
                  <Bar key={name} dataKey={name} stackId="hours" fill={storeColor(name)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {hourlyCompare.length > 0 && (
            <>
              <p className="text-xs mt-4 mb-2" style={{ color: "#8F7D6E" }}>
                全店舗合算・前年{priorYear}年比較
              </p>
              <div style={{ background: "#FFFFFF" }} className="p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={hourlyCompare}>
                    <CartesianGrid stroke="#F0E6D8" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fill: "#8F7D6E", fontSize: 11 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} interval={1} />
                    <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                    <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="今年" name={`${year}年`} fill="#D4A644" />
                    <Bar dataKey="前年" name={`${priorYear}年`} fill={PRIOR_YEAR_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>

        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            曜日別稼働率({year}年)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weekdayOccupancy}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="weekday" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {storeNames.map((name) => (
                  <Bar key={name} dataKey={name} fill={storeColor(name)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {weekdayCompare.length > 0 && (
            <>
              <p className="text-xs mt-4 mb-2" style={{ color: "#8F7D6E" }}>
                全店舗合算・前年{priorYear}年比較
              </p>
              <div style={{ background: "#FFFFFF" }} className="p-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={weekdayCompare}>
                    <CartesianGrid stroke="#F0E6D8" vertical={false} />
                    <XAxis dataKey="weekday" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                    <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="今年" name={`${year}年`} fill="#D4A644" />
                    <Bar dataKey="前年" name={`${priorYear}年`} fill={PRIOR_YEAR_COLOR} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
