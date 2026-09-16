import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../../api.js";
import { CHANNEL_COLOR, FONT_HEAD, yen, makeStoreColor } from "../../constants.js";

export default function RecentPage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sort, setSort] = useState("desc");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function load(startArg, endArg, sortArg) {
    try {
      const res = await api.searchTransactions({ start: startArg || undefined, end: endArg || undefined, sort: sortArg });
      setResult(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(start, end, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  function handleSearch(e) {
    e.preventDefault();
    load(start, end, sort);
  }

  function handleClear() {
    setStart("");
    setEnd("");
    load(undefined, undefined, sort);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
          利用履歴
        </h3>
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="text-sm px-3 py-2 border"
            style={{ borderColor: "#E7E2DB", background: "#FFFFFF" }}
          />
          <span style={{ color: "#8A857D" }}>〜</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="text-sm px-3 py-2 border"
            style={{ borderColor: "#E7E2DB", background: "#FFFFFF" }}
          />
          <button type="submit" className="text-sm px-3 py-2" style={{ background: "#345953", color: "#FAF8F5" }}>
            検索
          </button>
          {(start || end) && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm px-3 py-2 border"
              style={{ borderColor: "#E7E2DB", color: "#6B665F", background: "#FFFFFF" }}
            >
              クリア
            </button>
          )}
        </form>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: "#8C3B3B" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <p className="text-xs mb-2" style={{ color: "#8A857D" }}>
            {result.total}件中 最大{result.limit}件を表示
            {result.total > result.limit ? "(日付範囲を絞り込むと残りも確認できます)" : ""}
          </p>
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #E7E2DB" }}>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    <button
                      onClick={() => setSort(sort === "desc" ? "asc" : "desc")}
                      className="flex items-center gap-1"
                      style={{ color: "#8A857D" }}
                    >
                      日付
                      {sort === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    店舗
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    利用者
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    導線
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    状態
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    売上
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8A857D" }}>
                    利用時間
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F1EDE7" }}>
                    <td className="px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: storeColor(r.store) }} />
                      {r.store}
                    </td>
                    <td className="px-4 py-3">{r.user_name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5" style={{ background: "#F1EDE7", color: CHANNEL_COLOR[r.channel] || "#6B665F" }}>
                        {r.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#8A857D" }}>
                      {r.status}
                    </td>
                    <td className="px-4 py-3 text-right">{yen(r.revenue)}</td>
                    <td className="px-4 py-3 text-right">{r.hours_used.toFixed(1)}h</td>
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "#8A857D" }}>
                      該当する実績が見つかりません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
