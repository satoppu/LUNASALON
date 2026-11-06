import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { FONT_HEAD, yen } from "../../constants.js";

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

const CATEGORY_COLOR = {
  家賃: "#D4A644",
  水道光熱費: "#69CD60",
  通信費: "#55C2E8",
  消耗品費: "#D66B5C",
  保険料: "#A492EA",
  システム利用料: "#D9738F",
  広告宣伝費: "#8F4A28",
  支払手数料: "#8F7D6E",
  雑費: "#B8A88F",
  "開業費・設備費": "#262421",
};

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: "#FFFFFF" }} className="p-4 flex-1 min-w-[160px]">
      <p className="text-xs mb-1" style={{ color: "#8F7D6E" }}>
        {label}
      </p>
      <p style={{ fontFamily: FONT_HEAD, color: color ?? "#262421" }} className="text-xl font-bold">
        {value}
      </p>
      {sub && (
        <p className="text-xs mt-1" style={{ color: "#8F7D6E" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function MonthlyTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EDE3D5", padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#262421", fontWeight: 600, margin: "0 0 4px" }}>{d.label}</p>
      <p style={{ color: "#D4A644", margin: 0 }}>売上: {yen(d.revenue)}</p>
      <p style={{ color: "#D66B5C", margin: 0 }}>経費: {yen(d.expenseShown)}</p>
      <p style={{ color: "#262421", margin: 0 }}>営業利益: {yen(d.profitShown)}</p>
    </div>
  );
}

export default function ExpenseSummaryPage({ data }) {
  const year = data?.year;
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [includeInitialCost, setIncludeInitialCost] = useState(false);

  useEffect(() => {
    if (!year) return;
    api
      .getExpenseSummary(year)
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, [year]);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }
  if (!summary) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  const chartData = summary.months.map((m, i) => ({
    label: MONTH_LABELS[i],
    revenue: m.revenue,
    expenseShown: includeInitialCost ? m.expense : m.expenseExcludingInitialCost,
    profitShown: includeInitialCost ? m.profit : m.profitExcludingInitialCost,
  }));

  const totalRevenue = summary.months.reduce((s, m) => s + m.revenue, 0);
  const totalExpense = includeInitialCost
    ? summary.months.reduce((s, m) => s + m.expense, 0)
    : summary.months.reduce((s, m) => s + m.expenseExcludingInitialCost, 0);
  const totalInitialCost = summary.months.reduce((s, m) => s + m.initialCost, 0);
  const totalProfit = totalRevenue - totalExpense;
  const profitRate = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;

  const categoriesShown = includeInitialCost
    ? summary.categories
    : summary.categories.filter((c) => c.category !== "開業費・設備費");
  const categoryTotal = categoriesShown.reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <p className="text-sm mb-6" style={{ color: "#8F7D6E" }}>
        銀行明細・クレジットカード明細から手動で分類した経費と、既存の「利用売上」を突き合わせた{year}年の月次収支です。ASTERIA(つくば店)の開業に伴う一時的な家具・什器・保証金等は「開業費・設備費」として分けています。
      </p>

      <label className="flex items-center gap-2 text-sm mb-6" style={{ color: "#7A6A5C" }}>
        <input type="checkbox" checked={includeInitialCost} onChange={(e) => setIncludeInitialCost(e.target.checked)} />
        ASTERIA開業費・設備費(¥{totalInitialCost.toLocaleString()})を含める
      </label>

      <div className="flex flex-wrap gap-3 mb-8">
        <StatCard label="売上(利用売上ベース)" value={yen(totalRevenue)} />
        <StatCard label="経費" value={yen(totalExpense)} />
        <StatCard
          label="営業利益"
          value={yen(totalProfit)}
          color={totalProfit >= 0 ? "#5B8A4A" : "#A84434"}
          sub={profitRate == null ? undefined : `営業利益率 ${profitRate.toFixed(1)}%`}
        />
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          月次収支({year}年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid stroke="#F0E6D8" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
              <YAxis
                tick={{ fill: "#8F7D6E", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MonthlyTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#D4A644" name="売上" />
              <Bar dataKey="expenseShown" fill="#D66B5C" name="経費" />
              <Line type="monotone" dataKey="profitShown" name="営業利益" stroke="#262421" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          勘定科目別内訳({year}年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  勘定科目
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  金額
                </th>
                <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  構成比
                </th>
                <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  店舗別内訳
                </th>
              </tr>
            </thead>
            <tbody>
              {categoriesShown.map((c) => (
                <tr key={c.category} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ background: CATEGORY_COLOR[c.category] ?? "#8F7D6E" }}
                    />
                    {c.category}
                  </td>
                  <td className="px-4 py-3 text-right">{yen(c.total)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: "#8F7D6E" }}>
                    {categoryTotal > 0 ? `${((c.total / categoryTotal) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#8F7D6E" }}>
                    {Object.entries(c.byStore)
                      .map(([store, amt]) => `${store}: ${yen(amt)}`)
                      .join("　")}
                  </td>
                </tr>
              ))}
              {categoriesShown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                    データがありません。
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
