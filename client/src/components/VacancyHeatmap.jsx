import { useEffect, useState } from "react";
import { api } from "../api.js";
import { FONT_HEAD } from "../constants.js";

// 店舗×曜日×時間帯の稼働率ヒートマップ。色は1色(金)の濃淡で、薄いほど空いている。
// 段階で塗り分け、各マスに数値も出すので色だけに頼らない。
const BINS = [
  { min: 75, bg: "#6F5212", text: "#FFFFFF", label: "75%〜" },
  { min: 50, bg: "#A97F22", text: "#262421", label: "50〜75%" },
  { min: 25, bg: "#D4A644", text: "#262421", label: "25〜50%" },
  { min: 10, bg: "#E9CF8F", text: "#262421", label: "10〜25%" },
  { min: 0.1, bg: "#F6E9C9", text: "#262421", label: "〜10%" },
  { min: 0, bg: "#FFFFFF", text: "#8F7D6E", label: "0%(空き)" },
];
const binFor = (pct) => BINS.find((b) => (pct ?? 0) >= b.min) ?? BINS[BINS.length - 1];
const PERIODS = [1, 3, 6];
const avg = (xs) => {
  const v = xs.filter((x) => x != null);
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
};
const fmtDate = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

export default function VacancyHeatmap() {
  const [months, setMonths] = useState(3);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [storeIdx, setStoreIdx] = useState(0);

  useEffect(() => {
    setError(null);
    api
      .getVacancy(months)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [months]);

  const buttonStyle = (active) => ({
    background: active ? "#D4A644" : "#FFFFFF",
    color: active ? "#262421" : "#7A6A5C",
    border: "1px solid #EDE3D5",
  });

  const current = data?.stores[Math.min(storeIdx, (data?.stores.length ?? 1) - 1)];

  return (
    <div className="mb-12">
      <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-2">
        空き状況(店舗×曜日×時間帯)
      </h3>
      <p className="text-xs mb-4" style={{ color: "#8F7D6E" }}>
        各マスは、その曜日・時間帯が期間中に何%埋まっていたかです(色が薄いほど空いています)。空いている時間帯を狙った割引や告知の検討にお使いください。
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {data?.stores.map((s, i) => (
          <button key={s.store} type="button" onClick={() => setStoreIdx(i)} className="text-sm px-3 py-1.5" style={buttonStyle(i === storeIdx)}>
            {s.store}
          </button>
        ))}
        <span className="mx-1" style={{ color: "#EDE3D5" }}>
          |
        </span>
        {PERIODS.map((m) => (
          <button key={m} type="button" onClick={() => setMonths(m)} className="text-sm px-3 py-1.5" style={buttonStyle(m === months)}>
            直近{m}か月
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm" style={{ color: "#A84434" }}>
          {error}
        </p>
      )}

      {current && (
        <>
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto py-3 pr-3">
            <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", left: 0, zIndex: 1, background: "#FFFFFF", paddingLeft: 12, boxShadow: "3px 0 0 #FFFFFF" }} />
                  {data.hours.map((h) => (
                    <th key={h} className="font-medium px-1 pb-1" style={{ color: "#8F7D6E", minWidth: 34 }}>
                      {h}時
                    </th>
                  ))}
                  <th className="font-medium px-2 pb-1" style={{ color: "#8F7D6E" }}>
                    平均
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.weekdays.map((wd, wi) => (
                  <tr key={wd}>
                    <th className="font-medium pr-2 text-right" style={{ color: "#262421", position: "sticky", left: 0, zIndex: 1, background: "#FFFFFF", paddingLeft: 12, boxShadow: "3px 0 0 #FFFFFF" }}>
                      {wd}
                    </th>
                    {data.hours.map((h, hi) => {
                      const pct = current.grid[wi][hi];
                      const bin = binFor(pct);
                      return (
                        <td
                          key={h}
                          title={`${wd}曜 ${h}時台：稼働率 ${pct ?? 0}%(期間中 ${current.days[wi]}日)`}
                          className="text-center"
                          style={{ background: bin.bg, color: bin.text, height: 28, border: bin.min === 0 ? "1px solid #F0E6D8" : "none", borderRadius: 2 }}
                        >
                          {pct == null ? "–" : Math.round(pct)}
                        </td>
                      );
                    })}
                    <td className="text-center px-2 font-medium" style={{ color: "#262421" }}>
                      {avg(current.grid[wi]) ?? "–"}%
                    </td>
                  </tr>
                ))}
                <tr>
                  <th className="font-medium pr-2 text-right pt-1 whitespace-nowrap" style={{ color: "#8F7D6E", position: "sticky", left: 0, zIndex: 1, background: "#FFFFFF", paddingLeft: 12, boxShadow: "3px 0 0 #FFFFFF" }}>
                    平均
                  </th>
                  {data.hours.map((h, hi) => (
                    <td key={h} className="text-center font-medium pt-1" style={{ color: "#262421" }}>
                      {avg(current.grid.map((row) => row[hi])) ?? "–"}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3 text-xs" style={{ color: "#7A6A5C" }}>
            {[...BINS].reverse().map((b) => (
              <span key={b.label} className="flex items-center gap-1">
                <span style={{ display: "inline-block", width: 14, height: 14, background: b.bg, border: "1px solid #EDE3D5", borderRadius: 2 }} />
                {b.label}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: "#8F7D6E" }}>
            期間: {fmtDate(data.from)}〜{fmtDate(data.to)}(利用済みの実績)。数字は稼働率(%)。マスにカーソルを合わせると詳細が出ます。店舗の営業開始前の日は数えていません。
          </p>
        </>
      )}
    </div>
  );
}
