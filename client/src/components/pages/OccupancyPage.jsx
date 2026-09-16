import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { FONT_HEAD, makeStoreColor } from "../../constants.js";

export default function OccupancyPage({ data }) {
  const { year, storeNames, storeMeta, occupancyData, hourlyUsage, weekdayOccupancy } = data;
  const storeColor = makeStoreColor(storeMeta);

  return (
    <>
      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          稼働率比較({year}年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={220}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
    </>
  );
}
