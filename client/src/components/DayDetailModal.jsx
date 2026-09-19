import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api.js";
import { CHANNEL_BADGE, STATUS_BADGE, FONT_HEAD, yen, makeStoreColor } from "../constants.js";
import StoreBadge from "./StoreBadge.jsx";

export default function DayDetailModal({ date, storeMeta, onClose }) {
  const storeColor = makeStoreColor(storeMeta);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!date) return;
    setRows(null);
    setError(null);
    api
      .searchTransactions({ start: date, end: date, sort: "asc" })
      // The API's own sort is by date (all rows here share one, so it's a
      // no-op) then id — reorder by start_hour so the day reads chronologically.
      .then((res) => setRows([...res.rows].sort((a, b) => (a.start_hour ?? Infinity) - (b.start_hour ?? Infinity))))
      .catch((err) => setError(err.message));
  }, [date]);

  if (!date) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(38,36,33,0.4)" }}
      onClick={onClose}
    >
      <div className="w-full max-w-3xl mt-10 md:mt-0" style={{ background: "#FFFFFF" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-5" style={{ borderBottom: "1px solid #EDE3D5" }}>
          <h2 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-xl font-bold">
            {date} の予約明細
          </h2>
          <button onClick={onClose} style={{ color: "#8F7D6E" }} aria-label="閉じる">
            <X size={20} />
          </button>
        </div>

        {error && (
          <p className="text-sm px-6 py-4" style={{ color: "#A84434" }}>
            {error}
          </p>
        )}
        {!error && !rows && (
          <p className="text-sm px-6 py-4" style={{ color: "#8F7D6E" }}>
            読み込み中…
          </p>
        )}

        {rows && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    利用者
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    売上
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    開始時間
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    利用時間
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    店舗
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    導線
                  </th>
                  <th className="text-center px-6 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    状態
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                    <td className="px-6 py-3 text-left">{r.user_name}</td>
                    <td className="px-6 py-3 text-right font-medium">{yen(r.revenue)}</td>
                    <td className="px-6 py-3 text-center">{r.start_hour != null ? `${r.start_hour}時` : "—"}</td>
                    <td className="px-6 py-3 text-right">{r.hours_used.toFixed(1)}h</td>
                    <td className="px-6 py-3 text-center">
                      <StoreBadge store={r.store} storeColor={storeColor} />
                    </td>
                    <td className="px-6 py-3 text-center">
                      {CHANNEL_BADGE[r.channel] ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                          style={{ background: CHANNEL_BADGE[r.channel].bg, color: CHANNEL_BADGE[r.channel].text }}
                          title={r.channel}
                        >
                          {CHANNEL_BADGE[r.channel].label}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5" style={{ background: "#F3EBDF", color: "#7A6A5C" }}>
                          {r.channel}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {STATUS_BADGE[r.status] ? (
                        <span
                          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                          style={{ background: STATUS_BADGE[r.status].bg, color: STATUS_BADGE[r.status].text }}
                          title={r.status}
                        >
                          {STATUS_BADGE[r.status].label}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5" style={{ background: "#F3EBDF", color: "#7A6A5C" }}>
                          {r.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-6 text-center" style={{ color: "#8F7D6E" }}>
                      この日の予約はありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
