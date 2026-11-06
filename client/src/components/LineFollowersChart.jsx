import { useEffect, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { api } from "../api.js";
import { FONT_HEAD } from "../constants.js";

// LINE公式アカウントの友だち数・ターゲットリーチ・ブロック数の推移(毎朝LINEから取得して記録した分)。
const SERIES = [
  { key: "followers", name: "友だち", color: "#06C755" },
  { key: "targetedReaches", name: "ターゲットリーチ", color: "#D4A644" },
  { key: "blocks", name: "ブロック", color: "#A84434" },
];

const shortDate = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export default function LineFollowersChart() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .getLineStats()
      .then(({ stats }) => setStats(stats))
      .catch(() => setStats([]));
  }, []);

  if (!stats) return null;
  const latest = stats[stats.length - 1];
  const weekAgo = stats.length > 7 ? stats[stats.length - 8] : stats[0];
  const delta = (key) => {
    if (!latest || !weekAgo || latest[key] == null || weekAgo[key] == null || latest === weekAgo) return null;
    const d = latest[key] - weekAgo[key];
    return `${d >= 0 ? "+" : ""}${d}`;
  };

  return (
    <div className="mb-12">
      <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4 flex items-baseline flex-wrap gap-x-2">
        LINE友だち数の推移
        {latest && (
          <span className="text-xs font-normal" style={{ color: "#8F7D6E" }}>
            {shortDate(latest.date)}時点
          </span>
        )}
      </h3>
      {stats.length === 0 ? (
        <p className="text-sm" style={{ color: "#8F7D6E" }}>
          まだ記録がありません。毎朝の自動取り込みでLINEの数字が記録されると、ここに表示されます。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {SERIES.map((s) => (
              <div key={s.key} style={{ background: "#FFFFFF" }} className="p-3">
                <p className="text-xs" style={{ color: "#8F7D6E" }}>
                  {s.name}
                </p>
                <p className="text-xl font-bold" style={{ color: "#262421" }}>
                  {latest[s.key] ?? "—"}
                </p>
                {delta(s.key) && (
                  <p className="text-xs" style={{ color: "#8F7D6E" }}>
                    1週間で {delta(s.key)}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ background: "#FFFFFF" }} className="p-4">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats} margin={{ bottom: 8 }}>
                <CartesianGrid stroke="#F0E6D8" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: "#8F7D6E", fontSize: 11 }} axisLine={{ stroke: "#EDE3D5" }} tickLine={false} minTickGap={24} />
                <YAxis tick={{ fill: "#8F7D6E", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip labelFormatter={(d) => d} formatter={(v, name) => [`${v}人`, name]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {SERIES.map((s) => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={stats.length <= 14} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            毎朝LINEから前日時点の数字を取得しています(LINEのアプリに出る「今」の数字とは、当日分だけずれます)。ターゲットリーチは、友だちからブロックと属性が推定できない人を除いた、メッセージを届けられる人数です。
          </p>
        </>
      )}
    </div>
  );
}
