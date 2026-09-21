import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, ComposedChart, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../../api.js";
import { CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

function labelInterval(length) {
  return Math.max(0, Math.ceil(length / 12) - 1);
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
    bookingDateMonthlyTrend: data.bookingDateMonthlyTrend,
    hoursMonthlyTrend: data.hoursMonthlyTrend,
    yoyMonthly: data.yoyMonthly,
    yoyMonthlyCount: data.yoyMonthlyCount,
  });
  const { monthlyTrend, bookingDateMonthlyTrend, hoursMonthlyTrend, yoyMonthly, yoyMonthlyCount } = section;

  useEffect(() => {
    if (!store) {
      setSection({
        monthlyTrend: data.monthlyTrend,
        bookingDateMonthlyTrend: data.bookingDateMonthlyTrend,
        hoursMonthlyTrend: data.hoursMonthlyTrend,
        yoyMonthly: data.yoyMonthly,
        yoyMonthlyCount: data.yoyMonthlyCount,
      });
      return;
    }
    api
      .getRevenue(year, store)
      .then((res) =>
        setSection({
          monthlyTrend: res.monthlyTrend,
          bookingDateMonthlyTrend: res.bookingDateMonthlyTrend,
          hoursMonthlyTrend: res.hoursMonthlyTrend,
          yoyMonthly: res.yoyMonthly,
          yoyMonthlyCount: res.yoyMonthlyCount,
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
          売上推移({year}年・月別・通常予約 / 定期クーポン)
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
              <Tooltip formatter={(v) => yen(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="通常予約" stackId="revenue" fill="#D4A644" name="通常予約(利用日ベース)" />
              <Bar dataKey="定期クーポン" stackId="revenue" fill={CHANNEL_COLOR["定期クーポン"]} name="定期クーポン(利用日ベース)" />
              <Line
                type="monotone"
                dataKey="決済日ベース"
                name="決済日ベース(合計)"
                stroke="#262421"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          棒グラフは利用日基準、線グラフは決済日(自社サイト: 決済日時(データ入力用)、Instabase: 申込日時)基準の合計売上です。決済日が取得できない行は利用日を代用しています。自社サイトのキャンセルは、キャンセルが確定した月にマイナス反映されます。
        </p>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          決済日ベース売上推移(月別・過去3年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          {bookingDateMonthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bookingDateMonthlyTrend} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(bookingDateMonthlyTrend.length)}
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
                <Bar dataKey="revenue" name="決済日ベース売上" fill="#D9738F" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          決済日(自社サイト: 決済日時(データ入力用)、Instabase: 申込日時、定期クーポン: 購入日時)を基準にした月別合計売上です。選択中の年度に関わらず、直近36か月分を表示します。自社サイトのキャンセルは、キャンセルが確定した月にマイナス反映されます。
        </p>
      </div>

      <div className="mb-12">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          利用時間推移(月別・過去3年)
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4">
          {hoursMonthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hoursMonthlyTrend} margin={{ bottom: 24 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#8F7D6E", fontSize: 10 }}
                  axisLine={{ stroke: "#EDE3D5" }}
                  tickLine={false}
                  interval={labelInterval(hoursMonthlyTrend.length)}
                  angle={-40}
                  textAnchor="end"
                  height={50}
                />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip formatter={(v) => `${v}h`} />
                <Bar dataKey="hours" name="利用時間" fill="#D4A644" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: "#8F7D6E" }} className="text-sm py-8 text-center">
              対象データがありません。
            </p>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
          利用月ベースの合計利用時間です(全店舗・全チャネル)。定期クーポンは購入時にまとめて売上計上され実際の利用月には売上が乗らないため、金額より実際の稼働状況を正しく反映します。
        </p>
      </div>

      <div>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度比較(売上) — {yoyLabel}
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4 mb-4">
          {hasPriorYear ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yoyMonthly}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => yen(v)} />
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

        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
          年度比較(利用件数) — {yoyLabel}
        </h3>
        <div style={{ background: "#FFFFFF" }} className="p-4 mb-4">
          {hasPriorYear ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={yoyMonthlyCount}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}件`} />
                <Tooltip formatter={(v) => `${v}件`} />
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
                    当月売上
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    前年売上
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
