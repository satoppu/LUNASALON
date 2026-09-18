import { useState } from "react";
import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";
import ClickableUserName from "../ClickableUserName.jsx";
import { useCustomerLookup } from "../../hooks/useCustomerLookup.js";

export default function RankingPage({ data }) {
  const { year, storeMeta, userSummary } = data;
  const storeColor = makeStoreColor(storeMeta);
  const customerByName = useCustomerLookup();
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  return (
    <div>
      <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
        利用者別 売上トップ10({year}年)
      </h3>
      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                順位
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                利用者
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                主な店舗
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                利用回数
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                総利用時間
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                平均利用時間
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                総売上
              </th>
            </tr>
          </thead>
          <tbody>
            {userSummary.map((u, i) => (
              <tr key={u.user} style={{ borderBottom: "1px solid #F3EBDF" }}>
                <td className="px-4 py-3" style={{ fontFamily: FONT_HEAD, color: "#D4A644" }}>
                  {i + 1}
                </td>
                <td className="px-4 py-3">
                  <ClickableUserName name={u.user} customerByName={customerByName} onSelect={setSelectedCustomer} />
                </td>
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
      <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}
