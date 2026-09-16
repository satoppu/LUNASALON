import { CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function RecentPage({ data }) {
  const { year, storeMeta, recentRows } = data;
  const storeColor = makeStoreColor(storeMeta);

  return (
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
  );
}
