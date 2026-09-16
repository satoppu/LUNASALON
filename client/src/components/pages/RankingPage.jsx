import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function RankingPage({ data }) {
  const { year, storeMeta, userSummary } = data;
  const storeColor = makeStoreColor(storeMeta);

  return (
    <div>
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
  );
}
