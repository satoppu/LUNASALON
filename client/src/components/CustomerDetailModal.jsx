import { X } from "lucide-react";
import { FONT_HEAD, yen } from "../constants.js";

export default function CustomerDetailModal({ customer, onClose }) {
  if (!customer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(38,36,33,0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mt-10 md:mt-0"
        style={{ background: "#FFFFFF" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid #E7E2DB" }}>
          <div>
            <h2 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-xl font-bold mb-1">
              {customer.user}
            </h2>
            <p style={{ color: "#8A857D" }} className="text-sm">
              初回利用日: {customer.firstUseDate}
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#8A857D" }} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-8 px-6 py-4" style={{ borderBottom: "1px solid #E7E2DB" }}>
          <div>
            <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-xl font-bold">
              {customer.totalCount}
            </p>
            <p style={{ color: "#8A857D" }} className="text-xs">
              累計利用回数
            </p>
          </div>
          <div>
            <p style={{ fontFamily: FONT_HEAD, color: "#345953" }} className="text-xl font-bold">
              {yen(customer.totalRevenue)}
            </p>
            <p style={{ color: "#8A857D" }} className="text-xs">
              累計売上
            </p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
              <th className="text-left px-6 py-3 font-medium" style={{ color: "#8A857D" }}>
                年度
              </th>
              <th className="text-right px-6 py-3 font-medium" style={{ color: "#8A857D" }}>
                利用回数
              </th>
              <th className="text-right px-6 py-3 font-medium" style={{ color: "#8A857D" }}>
                利用金額
              </th>
            </tr>
          </thead>
          <tbody>
            {customer.byYear.map((y) => (
              <tr key={y.year} style={{ borderBottom: "1px solid #F1EDE7" }}>
                <td className="px-6 py-3">{y.year}年</td>
                <td className="px-6 py-3 text-right">{y.count}</td>
                <td className="px-6 py-3 text-right font-medium">{yen(y.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
