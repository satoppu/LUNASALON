import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

const MONTHLY_TREND_COLOR = {
  利用売上: "#D4A644",
  定額売上: CHANNEL_COLOR["定期クーポン"],
  利用合売: "#8F7D6E",
  予約売上: "#262421",
};

// 利用売上/定額売上は利用日(通常予約/定期クーポン)、予約売上は決済日
// (自社サイトの決済日時、Instabaseの申込日時)の合計売上 — 3つとも集計基準
// が異なるため、まとめて出すツールチップは各行を手書きする(recharts標準の
// Tooltipはシリーズの登録順で表示され、利用合計のような追加の計算行も
// 出せないため)。
function MonthlyTrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const rows = [
    { key: "利用売上", text: yen(d.利用売上), color: MONTHLY_TREND_COLOR.利用売上 },
    { key: "定額売上", text: yen(d.定額売上), color: MONTHLY_TREND_COLOR.定額売上 },
    { key: "利用合売", text: yen(d.利用売上 + d.定額売上), color: MONTHLY_TREND_COLOR.利用合売 },
    { key: "予約売上", text: yen(d.予約売上), color: MONTHLY_TREND_COLOR.予約売上 },
  ];
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #EDE3D5", padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#262421", fontWeight: 600, margin: "0 0 4px" }}>{d.label}</p>
      {rows.map((row) => (
        <p key={row.key} style={{ color: row.color, margin: 0 }}>
          {row.key}:{row.text}
        </p>
      ))}
    </div>
  );
}

// 予約売上/利用全売上/利用件数/利用時間の4つとも「year/priorYear/priorYear2を
// 折れ線で重ねて比較する」同じ形のグラフなので、共通コンポーネントにまとめる。
function YoyLineChart({ title, yoyLabel, data, year, priorYear, priorYear2, hasPriorYear, hasPriorYear2, tickFormatter, tooltipFormatter }) {
  return (
    <div className="mb-12">
      <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
        {title} — {yoyLabel}
      </h3>
      <div style={{ background: "#FFFFFF" }} className="p-4">
        {hasPriorYear ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid stroke="#F0E6D8" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
              <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={tickFormatter} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey={`${year}年`} stroke="#D4A644" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey={`${priorYear}年`} stroke="#D66B5C" strokeWidth={2.5} strokeDasharray="4 3" dot={false} connectNulls />
              {hasPriorYear2 && (
                <Line type="monotone" dataKey={`${priorYear2}年`} stroke="#8F4A28" strokeWidth={2.5} strokeDasharray="2 2" dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
            {priorYear}年のデータがないため比較できません。
          </p>
        )}
      </div>
    </div>
  );
}

export default function RevenuePage({ data }) {
  const { year, priorYear, hasPriorYear, priorYear2, hasPriorYear2, storeMeta, storeNames } = data;
  const storeColor = makeStoreColor(storeMeta);
  const yoyLabel = [year, hasPriorYear && priorYear, hasPriorYear2 && priorYear2]
    .filter(Boolean)
    .map((y) => `${y}年`)
    .join(" vs ");

  const [store, setStore] = useState("");
  const [section, setSection] = useState({
    monthlyTrend: data.monthlyTrend,
    yoyMonthly: data.yoyMonthly,
    yoyMonthlyCount: data.yoyMonthlyCount,
    yoyBookingRevenue: data.yoyBookingRevenue,
    yoyHours: data.yoyHours,
  });
  const { monthlyTrend, yoyMonthly, yoyMonthlyCount, yoyBookingRevenue, yoyHours } = section;

  useEffect(() => {
    if (!store) {
      setSection({
        monthlyTrend: data.monthlyTrend,
        yoyMonthly: data.yoyMonthly,
        yoyMonthlyCount: data.yoyMonthlyCount,
        yoyBookingRevenue: data.yoyBookingRevenue,
        yoyHours: data.yoyHours,
      });
      return;
    }
    api
      .getRevenue(year, store)
      .then((res) =>
        setSection({
          monthlyTrend: res.monthlyTrend,
          yoyMonthly: res.yoyMonthly,
          yoyMonthlyCount: res.yoyMonthlyCount,
          yoyBookingRevenue: res.yoyBookingRevenue,
          yoyHours: res.yoyHours,
        })
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, store, data]);

  const [month, setMonth] = useState(data.yoyByStore[0]?.latestMonth ?? new Date().getMonth() + 1);
  const [yoyByStore, setYoyByStore] = useState(data.yoyByStore);

  useEffect(() => {
    api
      .getYoyByStore(year, month, store)
      .then((res) => setYoyByStore(res.yoyByStore))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, store]);

  return (
    <>
      <div className="mb-4">
        <select
          value={store}
          onChange={(e) => setStore(e.target.value)}
          className="text-sm px-3 py-2 border"
          style={{ borderColor: "#EDE3D5", color: "#262421", background: "#FFFFFF" }}
        >
          <option value="">店舗(すべて)</option>
          {storeNames?.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          売上推移({year}年・月別・利用売上 / 定額売上)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyTrend}>
              <CartesianGrid stroke="#F0E6D8" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
              <YAxis
                tick={{ fill: "#8F7D6E", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<MonthlyTrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="利用売上" stackId="revenue" fill={MONTHLY_TREND_COLOR.利用売上} name="利用売上" />
              <Bar dataKey="定額売上" stackId="revenue" fill={MONTHLY_TREND_COLOR.定額売上} name="定額売上" />
              <Line type="monotone" dataKey="予約売上" name="予約売上" stroke={MONTHLY_TREND_COLOR.予約売上} strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          利用売上・定額売上は利用日、予約売上は決済日(自社サイト: 決済日時(データ入力用)、Instabase: 申込日時)の合計売上です。決済日が取得できない行は利用日を代用しています。自社サイトのキャンセルは、キャンセルが確定した月にマイナス反映されます。
        </p>
      </div>

      <YoyLineChart
        title="予約売上"
        yoyLabel={yoyLabel}
        data={yoyBookingRevenue}
        year={year}
        priorYear={priorYear}
        priorYear2={priorYear2}
        hasPriorYear={hasPriorYear}
        hasPriorYear2={hasPriorYear2}
        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
        tooltipFormatter={(v) => yen(v)}
      />

      <YoyLineChart
        title="利用全売上"
        yoyLabel={yoyLabel}
        data={yoyMonthly}
        year={year}
        priorYear={priorYear}
        priorYear2={priorYear2}
        hasPriorYear={hasPriorYear}
        hasPriorYear2={hasPriorYear2}
        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
        tooltipFormatter={(v) => yen(v)}
      />

      <YoyLineChart
        title="利用件数"
        yoyLabel={yoyLabel}
        data={yoyMonthlyCount}
        year={year}
        priorYear={priorYear}
        priorYear2={priorYear2}
        hasPriorYear={hasPriorYear}
        hasPriorYear2={hasPriorYear2}
        tickFormatter={(v) => `${v}件`}
        tooltipFormatter={(v) => `${v}件`}
      />

      <YoyLineChart
        title="利用時間"
        yoyLabel={yoyLabel}
        data={yoyHours}
        year={year}
        priorYear={priorYear}
        priorYear2={priorYear2}
        hasPriorYear={hasPriorYear}
        hasPriorYear2={hasPriorYear2}
        tickFormatter={(v) => `${v}h`}
        tooltipFormatter={(v) => `${v}h`}
      />

      <div>
        <div className="flex items-center justify-end gap-2 mb-2">
          <label className="text-xs" style={{ color: "#8F7D6E" }}>
            対象月
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="text-sm px-3 py-1.5 border"
            style={{ borderColor: "#EDE3D5", color: "#262421", background: "#FFFFFF" }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
        </div>

        {yoyByStore.length > 0 && (
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    店舗({month}月)
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    当月利用全売上
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    前年利用全売上
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    前年同月比
                  </th>
                </tr>
              </thead>
              <tbody>
                {yoyByStore.map((y) => (
                  <tr key={y.store} style={{ borderBottom: "1px solid #F3EBDF" }}>
                    <td className="px-4 py-3">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(y.store) }} />
                      {y.store}
                    </td>
                    <td className="px-4 py-3 text-right">{yen(y.curRevenue)}</td>
                    <td className="px-4 py-3 text-right">{y.hasPrev ? yen(y.prevRevenue) : "—"}</td>
                    <td className="px-4 py-3 text-center" style={{ color: y.pct == null ? "#8F7D6E" : y.pct >= 0 ? "#D4A644" : "#D66B5C" }}>
                      {y.pct == null ? "前年データなし" : `${y.pct >= 0 ? "+" : ""}${y.pct.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                {(() => {
                  const totalCur = yoyByStore.reduce((sum, y) => sum + y.curRevenue, 0);
                  const prevStores = yoyByStore.filter((y) => y.hasPrev);
                  const totalPrev = prevStores.reduce((sum, y) => sum + y.prevRevenue, 0);
                  const hasTotalPrev = prevStores.length > 0;
                  const totalPct = hasTotalPrev && totalPrev > 0 ? ((totalCur - totalPrev) / totalPrev) * 100 : null;
                  return (
                    <tr style={{ borderTop: "2px solid #EDE3D5" }}>
                      <td className="px-4 py-3 font-medium">合計</td>
                      <td className="px-4 py-3 text-right font-medium">{yen(totalCur)}</td>
                      <td className="px-4 py-3 text-right font-medium">{hasTotalPrev ? yen(totalPrev) : "—"}</td>
                      <td
                        className="px-4 py-3 text-center font-medium"
                        style={{ color: totalPct == null ? "#8F7D6E" : totalPct >= 0 ? "#D4A644" : "#D66B5C" }}
                      >
                        {totalPct == null ? "前年データなし" : `${totalPct >= 0 ? "+" : ""}${totalPct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
