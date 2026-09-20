import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, yen, makeStoreColor, formatDateShort } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";
import StoreBadge from "../StoreBadge.jsx";
import RankingPage from "./RankingPage.jsx";

function labelInterval(length) {
  return Math.max(0, Math.ceil(length / 8) - 1);
}

// Ordered (0/1/2/3+ months) so a light-to-dark ramp in one hue reads more
// clearly than unrelated categorical colors, which put 同月予約 and
// 2ヶ月前予約 too close in hue to tell apart at a glance.
const LEAD_MONTH_COLORS = {
  同月予約: "#F0DFB0",
  "1ヶ月前予約": "#E3B563",
  "2ヶ月前予約": "#C48A3A",
  "3ヶ月以上前予約": "#8F4A28",
};

export default function CustomerPage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [monthFilter, setMonthFilter] = useState(null);

  useEffect(() => {
    api
      .getCustomers()
      .then(setState)
      .catch((err) => setError(err.message));
  }, []);

  const customersByName = useMemo(() => {
    if (!state) return new Map();
    return new Map(state.customers.map((c) => [c.user, c]));
  }, [state]);

  const monthFilteredCustomers = useMemo(() => {
    if (!state || !monthFilter) return [];
    if (monthFilter.type === "new") {
      return state.customers.filter((c) => c.firstUseDate.slice(0, 7) === monthFilter.yearMonth);
    }
    const entry = state.activeCustomersByMonth.find((m) => m.yearMonth === monthFilter.yearMonth);
    return (entry?.users || []).map((name) => customersByName.get(name)).filter(Boolean);
  }, [state, monthFilter, customersByName]);

  // Customers with 5+ lifetime visits who haven't returned in 2.5〜4 months
  // (4+ months is excluded — by then they're likely just gone, not "about to
  // churn," which is the window worth reaching out to).
  const dormantCustomers = useMemo(() => {
    if (!state) return [];
    const now = new Date();
    return state.customers
      .filter((c) => c.totalCount >= 5)
      .map((c) => ({ ...c, monthsSinceLastUse: (now - new Date(c.lastUseDate)) / (1000 * 60 * 60 * 24 * 30.44) }))
      .filter((c) => c.monthsSinceLastUse >= 2.5 && c.monthsSinceLastUse < 4)
      .sort((a, b) => b.monthsSinceLastUse - a.monthsSinceLastUse);
  }, [state]);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }
  if (!state) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  return (
    <>
      <div className="mb-12">
        <RankingPage data={data} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            新規顧客数(月別・全期間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={state.newCustomersByMonth} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(state.newCustomersByMonth.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}人`} />
                <Bar
                  dataKey="count"
                  fill="#D4A644"
                  cursor="pointer"
                  onClick={(d) => setMonthFilter({ type: "new", yearMonth: d.yearMonth, label: d.label })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            棒をクリックすると、その月に新規で来店したお客様の一覧を表示します。
          </p>
        </div>

        <div>
          <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
            アクティブ顧客数(月別・全期間)
          </h3>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={state.activeCustomersByMonth} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(state.activeCustomersByMonth.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}人`} />
                <Bar
                  dataKey="count"
                  fill="#D66B5C"
                  cursor="pointer"
                  onClick={(d) => setMonthFilter({ type: "active", yearMonth: d.yearMonth, label: d.label })}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            アクティブ = 累計利用5回以上、かつ直近3か月以内に利用。棒をクリックするとその月のアクティブなお客様の一覧を表示します。
          </p>
        </div>
      </div>

      {monthFilter && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
              {monthFilter.label}の{monthFilter.type === "new" ? "新規" : "アクティブ"}顧客({monthFilteredCustomers.length}人・クリックで詳細)
            </h3>
            <button
              type="button"
              onClick={() => setMonthFilter(null)}
              className="text-sm px-3 py-2 border"
              style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
            >
              閉じる
            </button>
          </div>
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0" style={{ background: "#FFFFFF" }}>
                <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    利用者
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    売上
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    回数
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    初回
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    店舗
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthFilteredCustomers.map((c) => (
                  <tr
                    key={c.user}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer"
                    style={{ borderBottom: "1px solid #F3EBDF" }}
                  >
                    <td className="px-4 py-3 text-left">{c.user}</td>
                    <td className="px-4 py-3 text-right font-medium">{yen(c.totalRevenue)}</td>
                    <td className="px-4 py-3 text-center">{c.totalCount}</td>
                    <td className="px-4 py-3 text-center">{formatDateShort(c.firstUseDate)}</td>
                    <td className="px-4 py-3 text-center">
                      <StoreBadge store={c.primaryStore} storeColor={storeColor} />
                    </td>
                  </tr>
                ))}
                {monthFilteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                      該当する顧客が見つかりません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          長期未来店のお客様(利用5回以上・2.5〜4ヶ月未来店・{dormantCustomers.length}人・クリックで詳細)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="sticky top-0" style={{ background: "#FFFFFF" }}>
              <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  利用者
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  店舗
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  回数
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  最終利用日
                </th>
                <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  未来店期間
                </th>
              </tr>
            </thead>
            <tbody>
              {dormantCustomers.map((c) => (
                <tr
                  key={c.user}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer"
                  style={{ borderBottom: "1px solid #F3EBDF" }}
                >
                  <td className="px-4 py-3 text-left">{c.user}</td>
                  <td className="px-4 py-3 text-center">
                    <StoreBadge store={c.primaryStore} storeColor={storeColor} />
                  </td>
                  <td className="px-4 py-3 text-center">{c.totalCount}</td>
                  <td className="px-4 py-3 text-center">{formatDateShort(c.lastUseDate)}</td>
                  <td className="px-4 py-3 text-center">{c.monthsSinceLastUse.toFixed(1)}ヶ月</td>
                </tr>
              ))}
              {dormantCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                    該当する顧客が見つかりません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v}件`} />
                <Bar dataKey="count" fill="#D9738F" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          自社サイトの予約データのうち、決済日時(データ入力用)を取得できた分のみが対象です(過去にインポートした一部のデータは対象外)。
        </p>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          月別 予約→利用の対応(過去3年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          {state.bookingToUsageMonthly.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={state.bookingToUsageMonthly} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(state.bookingToUsageMonthly.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "#8F7D6E", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v) => yen(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="同月予約" stackId="lead" fill={LEAD_MONTH_COLORS.同月予約} />
                <Bar dataKey="1ヶ月前予約" stackId="lead" fill={LEAD_MONTH_COLORS["1ヶ月前予約"]} />
                <Bar dataKey="2ヶ月前予約" stackId="lead" fill={LEAD_MONTH_COLORS["2ヶ月前予約"]} />
                <Bar dataKey="3ヶ月以上前予約" stackId="lead" fill={LEAD_MONTH_COLORS["3ヶ月以上前予約"]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          横軸は利用月。その月に利用された予約が、何ヶ月前に決済(予約)されたかを積み上げで表示します(自社サイトのみ、決済日時(データ入力用)が取得できた分が対象)。年をまたいだ季節的な予約傾向の比較にご利用ください。
        </p>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          月別 予約→利用の対応(利用時間ベース・過去3年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          {state.bookingToUsageMonthlyHours.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={state.bookingToUsageMonthlyHours} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(state.bookingToUsageMonthlyHours.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}h`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="同月予約" stackId="lead" fill={LEAD_MONTH_COLORS.同月予約} />
                <Bar dataKey="1ヶ月前予約" stackId="lead" fill={LEAD_MONTH_COLORS["1ヶ月前予約"]} />
                <Bar dataKey="2ヶ月前予約" stackId="lead" fill={LEAD_MONTH_COLORS["2ヶ月前予約"]} />
                <Bar dataKey="3ヶ月以上前予約" stackId="lead" fill={LEAD_MONTH_COLORS["3ヶ月以上前予約"]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          上のグラフと同じ区分けですが、金額ではなく利用時間を積み上げています。定期クーポンの影響を受けないため、実際の部屋の稼働状況をより正確に反映します。
        </p>
      </div>

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
              {state.cabinetList.map((c) => (
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
              {state.cabinetList.length === 0 && (
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

      <div className="mb-12">
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
              {state.couponPurchaseList.map((c) => (
                <tr key={c.user} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-4 py-3 text-left">{c.user}</td>
                  <td className="px-4 py-3 text-center">{formatDateShort(c.firstPurchaseDate)}</td>
                  <td className="px-4 py-3 text-center">{c.purchaseCount}</td>
                  <td className="px-4 py-3 text-center" style={!c.couponId ? { color: "#8F7D6E" } : undefined}>
                    {c.couponId || "—"}
                  </td>
                </tr>
              ))}
              {state.couponPurchaseList.length === 0 && (
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

      <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} />
    </>
  );
}
