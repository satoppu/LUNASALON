import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../../api.js";
import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";
import StoreBadge from "../StoreBadge.jsx";

export default function CustomerListPage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api
      .getCustomers()
      .then((res) => setCustomers(res.customers))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return [];
    const q = query.trim();
    if (!q) return customers;
    return customers.filter((c) => c.user.includes(q));
  }, [customers, query]);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }
  if (!customers) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
          顧客一覧({customers.length}人・クリックで詳細)
        </h3>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #EDE3D5" }}>
          <Search size={14} style={{ color: "#8F7D6E" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="顧客名で検索"
            className="text-sm outline-none"
            style={{ background: "transparent" }}
          />
        </div>
      </div>
      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                利用者
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                主な店舗
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                初回利用日
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                累計利用回数
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                キャンセル数
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                クーポン購入回数
              </th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                累計売上
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.user}
                onClick={() => setSelected(c)}
                className="cursor-pointer"
                style={{ borderBottom: "1px solid #F3EBDF" }}
              >
                <td className="px-4 py-3">{c.user}</td>
                <td className="px-4 py-3">
                  <StoreBadge store={c.primaryStore} storeColor={storeColor} />
                </td>
                <td className="px-4 py-3">{c.firstUseDate}</td>
                <td className="px-4 py-3 text-right">{c.totalCount}</td>
                <td className="px-4 py-3 text-right">{c.totalCancelCount}</td>
                <td className="px-4 py-3 text-right">{c.totalSubscriptionCount}</td>
                <td className="px-4 py-3 text-right font-medium">{yen(c.totalRevenue)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                  該当する顧客が見つかりません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />
    </>
  );
}
