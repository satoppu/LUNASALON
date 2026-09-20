import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { FONT_HEAD, makeStoreColor, formatDateShort } from "../../constants.js";
import StoreBadge from "../StoreBadge.jsx";

export default function ReferencePage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [cabinets, setCabinets] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([api.getCabinets(), api.getCouponPurchases()])
      .then(([c, p]) => {
        setCabinets(c.cabinets);
        setPurchases(p.purchases);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }
  if (!cabinets || !purchases) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  return (
    <div>
      <p className="text-sm mb-8" style={{ color: "#8F7D6E" }}>
        キャビネットの割当や定額クーポンIDの参照用一覧です。変更・削除は設定→記録の「キャビネット・クーポン」で行えます。
      </p>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          キャビネット貸し出し一覧
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  店舗名
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  番号
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  利用者
                </th>
              </tr>
            </thead>
            <tbody>
              {cabinets.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-4 py-3 text-center">
                    <StoreBadge store={c.store} storeColor={storeColor} />
                  </td>
                  <td className="px-4 py-3 text-center">{c.slot_label}</td>
                  <td className="px-4 py-3 text-left" style={!c.user_name ? { color: "#8F7D6E" } : undefined}>
                    {c.user_name || "空き"}
                  </td>
                </tr>
              ))}
              {cabinets.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                    登録されているキャビネットがありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          定額クーポンの一覧
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  利用者
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  初回購入日
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  購入回数
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  ID
                </th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((c) => (
                <tr key={c.user} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-4 py-3 text-left">{c.user}</td>
                  <td className="px-4 py-3 text-center">{c.firstPurchaseDate ? formatDateShort(c.firstPurchaseDate) : "—"}</td>
                  <td className="px-4 py-3 text-center">{c.purchaseCount}</td>
                  <td className="px-4 py-3 text-center" style={!c.couponId ? { color: "#8F7D6E" } : undefined}>
                    {c.couponId || "—"}
                  </td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                    定額クーポンの購入履歴がありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
