import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CHANNELS, CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function ChannelPage({ data }) {
  const { year, storeMeta, channelSummary, channelByStore } = data;
  const storeColor = makeStoreColor(storeMeta);

  return (
    <div>
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
  );
}
