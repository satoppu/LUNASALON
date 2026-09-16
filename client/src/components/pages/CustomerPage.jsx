import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, yen } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";

function labelInterval(length) {
  return Math.max(0, Math.ceil(length / 8) - 1);
}

export default function CustomerPage() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api
      .getCustomers()
      .then(setState)
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!state) return [];
    const q = query.trim();
    if (!q) return state.customers;
    return state.customers.filter((c) => c.user.includes(q));
  }, [state, query]);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A83A56" }}>
        {error}
      </p>
    );
  }
  if (!state) {
    return <p style={{ color: "#8F7B82" }}>読み込み中…</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            新規顧客数(月別・全期間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={state.newCustomersByMonth} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E3E7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7B82", fontSize: 10 }}
                  axisLine={{ stroke: "#EAE0E3" }}
                  tickLine={false}
                  interval={labelInterval(state.newCustomersByMonth.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}人`} />
                <Bar dataKey="count" fill="#B5306A" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            アクティブ顧客数(月別・全期間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={state.activeCustomersByMonth} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E3E7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7B82", fontSize: 10 }}
                  axisLine={{ stroke: "#EAE0E3" }}
                  tickLine={false}
                  interval={labelInterval(state.activeCustomersByMonth.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}人`} />
                <Bar dataKey="count" fill="#3E7FB0" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7B82" }}>
            アクティブ = 累計利用5回以上、かつ直近3か月以内に利用
          </p>
        </div>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          予約は何日前にされているか(全期間・{state.bookingLeadTime.total}件)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          {state.bookingLeadTime.total > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={state.bookingLeadTime.buckets}>
                <CartesianGrid stroke="#F0E3E7" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={{ stroke: "#EAE0E3" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7B82", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}件`} />
                <Bar dataKey="count" fill="#C68A2E" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7B82" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7B82" }}>
          自社サイト・Instabaseの予約データのうち、予約日時を取得できた分のみが対象です(過去にインポートした一部のデータは対象外)。
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
            顧客一覧({state.customers.length}人・クリックで詳細)
          </h3>
          <div className="flex items-center gap-2 px-3 py-2" style={{ background: "#FFFFFF", border: "1px solid #EAE0E3" }}>
            <Search size={14} style={{ color: "#8F7B82" }} />
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
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "#FFFFFF" }}>
              <tr style={{ borderBottom: "1px solid #EAE0E3" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  利用者
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  初回利用日
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  累計利用回数
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  キャンセル数
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
                  クーポン購入回数
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7B82" }}>
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
                  style={{ borderBottom: "1px solid #F3E7EA" }}
                >
                  <td className="px-4 py-3">{c.user}</td>
                  <td className="px-4 py-3">{c.firstUseDate}</td>
                  <td className="px-4 py-3 text-right">{c.totalCount}</td>
                  <td className="px-4 py-3 text-right">{c.totalCancelCount}</td>
                  <td className="px-4 py-3 text-right">{c.totalSubscriptionCount}</td>
                  <td className="px-4 py-3 text-right font-medium">{yen(c.totalRevenue)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center" style={{ color: "#8F7B82" }}>
                    該当する顧客が見つかりません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />
    </>
  );
}
