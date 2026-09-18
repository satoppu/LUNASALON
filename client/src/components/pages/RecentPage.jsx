import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, Download } from "lucide-react";
import { api } from "../../api.js";
import { CHANNEL_BADGE, STATUS_BADGE, FONT_HEAD, yen, makeStoreColor, formatDateShort } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";
import ClickableUserName from "../ClickableUserName.jsx";
import StoreBadge from "../StoreBadge.jsx";
import { useCustomerLookup } from "../../hooks/useCustomerLookup.js";

const PAGE_SIZE = 100;

export default function RecentPage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [store, setStore] = useState("");
  const [status, setStatus] = useState("");
  const [user, setUser] = useState("");
  const [sort, setSort] = useState("desc");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ stores: [], statuses: [] });
  const customerByName = useCustomerLookup();
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    api.getTransactionFilters().then(setFilters).catch(() => {});
  }, []);

  async function load(params, offsetArg) {
    try {
      const res = await api.searchTransactions({ ...params, offset: offsetArg || undefined });
      setResult(res);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function currentParams() {
    return {
      start: start || undefined,
      end: end || undefined,
      store: store || undefined,
      status: status || undefined,
      user: user || undefined,
      sort,
    };
  }

  useEffect(() => {
    load(currentParams(), offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, offset]);

  function handleSearch(e) {
    e.preventDefault();
    setOffset(0);
    load(currentParams(), 0);
  }

  function handleClear() {
    setStart("");
    setEnd("");
    setStore("");
    setStatus("");
    setUser("");
    setOffset(0);
    load({ sort }, 0);
  }

  const hasFilters = start || end || store || status || user;
  const selectClass = "text-sm px-3 py-2 border";
  const selectStyle = { borderColor: "#EDE3D5", background: "#FFFFFF" };

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
            className={selectClass}
            style={selectStyle}
          />
          <span style={{ color: "#8F7D6E" }}>〜</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={selectClass}
            style={selectStyle}
          />
          <select value={store} onChange={(e) => setStore(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">店舗(すべて)</option>
            {filters.stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">状態(すべて)</option>
            {filters.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="利用者名で検索"
            className={selectClass}
            style={selectStyle}
          />
          <button type="submit" className="text-sm px-3 py-2" style={{ background: "#D4A644", color: "#262421" }}>
            検索
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="text-sm px-3 py-2 border"
              style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
            >
              クリア
            </button>
          )}
        </form>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: "#A84434" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <p className="text-xs" style={{ color: "#8F7D6E" }}>
              {result.total}件中 {result.total === 0 ? 0 : result.offset + 1}〜{Math.min(result.offset + result.limit, result.total)}件を表示
            </p>
            <div className="flex items-center gap-2">
              <a
                href={api.transactionsExportUrl(currentParams())}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border"
                style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
              >
                <Download size={14} />
                エクスポート
              </a>
              {result.total > result.limit && (
                <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(offset - PAGE_SIZE, 0))}
                  className="text-sm px-3 py-1.5 border disabled:opacity-40"
                  style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
                >
                  前へ
                </button>
                <button
                  type="button"
                  disabled={offset + result.limit >= result.total}
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  className="text-sm px-3 py-1.5 border disabled:opacity-40"
                  style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
                >
                  次へ
                </button>
              </div>
            )}
            </div>
          </div>
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    <button
                      onClick={() => {
                        setSort(sort === "desc" ? "asc" : "desc");
                        setOffset(0);
                      }}
                      className="inline-flex items-center gap-1"
                      style={{ color: "#8F7D6E" }}
                    >
                      日付
                      {sort === "desc" ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                    </button>
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    利用者
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    売上
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    利用時間
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    店舗
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    導線
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    状態
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                    <td className="px-4 py-3">{formatDateShort(r.date)}</td>
                    <td className="px-4 py-3">
                      <ClickableUserName name={r.user_name} customerByName={customerByName} onSelect={setSelectedCustomer} />
                    </td>
                    <td className="px-4 py-3 text-right">{yen(r.revenue)}</td>
                    <td className="px-4 py-3 text-center">{r.hours_used.toFixed(1)}h</td>
                    <td className="px-4 py-3 text-center">
                      <StoreBadge store={r.store} storeColor={storeColor} />
                    </td>
                    <td className="px-4 py-3 text-center">
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
                    <td className="px-4 py-3 text-center">
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
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                      該当する実績が見つかりません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
      <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
    </div>
  );
}
