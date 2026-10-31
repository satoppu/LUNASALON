import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Download, ArrowUp, ArrowDown } from "lucide-react";
import { api } from "../../api.js";
import { FONT_HEAD, yen, makeStoreColor, formatDateShort, truncateName } from "../../constants.js";
import CustomerDetailModal from "../CustomerDetailModal.jsx";
import StoreBadge from "../StoreBadge.jsx";

const SORTABLE_COLUMNS = [
  { key: "user", label: "利用者" },
  { key: "totalRevenue", label: "売上" },
  { key: "totalCount", label: "回数" },
  { key: "totalSubscriptionCount", label: "クーポン" },
  { key: "totalCancelCount", label: "取消" },
  { key: "firstUseDate", label: "初回" },
];

export default function CustomerListPage({ data, onNavigateToHistory }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const storeNames = data?.storeNames || [];
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [store, setStore] = useState("");
  const [user, setUser] = useState("");
  const [selected, setSelected] = useState(null);
  const [sortKey, setSortKey] = useState("totalRevenue");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    api
      .getCustomers()
      .then((res) => setCustomers(res.customers))
      .catch((err) => setError(err.message));
  }, []);

  function handleSort(key) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    if (!customers) return [];
    const rows = customers.filter((c) => {
      if (user.trim() && !c.user.includes(user.trim())) return false;
      if (store && c.primaryStore !== store) return false;
      if (start && c.firstUseDate < start) return false;
      if (end && c.firstUseDate > end) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[sortKey] < b[sortKey] ? -1 : a[sortKey] > b[sortKey] ? 1 : 0) * dir);
  }, [customers, start, end, store, user, sortKey, sortDir]);

  const hasFilters = start || end || store || user;
  const selectClass = "text-sm px-3 py-2 border";
  const selectStyle = { borderColor: "#EDE3D5", background: "#FFFFFF" };

  function handleClear() {
    setStart("");
    setEnd("");
    setStore("");
    setUser("");
  }

  function handleExport() {
    const csv = Papa.unparse(
      filtered.map((c) => ({
        利用者: c.user,
        主な店舗: c.primaryStore,
        初回利用日: c.firstUseDate,
        最終利用日: c.lastUseDate,
        累計利用回数: c.totalCount,
        キャンセル数: c.totalCancelCount,
        クーポン購入回数: c.totalSubscriptionCount,
        累計売上: c.totalRevenue,
      }))
    );
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "luna_customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <p className="text-sm" style={{ color: "#A84434" }}>
        {error}
      </p>
    );
  }
  if (!customers) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
          顧客一覧
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
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
              {storeNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="text"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="顧客名で検索"
              className={selectClass}
              style={selectStyle}
            />
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
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <p className="text-xs" style={{ color: "#8F7D6E" }}>
          {filtered.length}人を表示(全{customers.length}人・クリックで詳細)
        </p>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 border"
          style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
        >
          <Download size={14} />
          エクスポート
        </button>
      </div>

      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
              {SORTABLE_COLUMNS.map((col) => (
                <th key={col.key} className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className="inline-flex items-center gap-1"
                    style={{ color: sortKey === col.key ? "#262421" : "#8F7D6E" }}
                  >
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : (
                      <ArrowDown size={12} style={{ opacity: 0.25 }} />
                    )}
                  </button>
                </th>
              ))}
              <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                店舗
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.user}
                onClick={() => setSelected(c)}
                className="cursor-pointer"
                style={{ borderBottom: "1px solid #F3EBDF" }}
              >
                <td className="px-4 py-3 text-left" title={c.user}>
                  {truncateName(c.user)}
                </td>
                <td className="px-4 py-3 text-right font-medium">{yen(c.totalRevenue)}</td>
                <td className="px-4 py-3 text-center">{c.totalCount}</td>
                <td className="px-4 py-3 text-center">{c.totalSubscriptionCount}</td>
                <td className="px-4 py-3 text-center">{c.totalCancelCount}</td>
                <td className="px-4 py-3 text-center">{formatDateShort(c.firstUseDate)}</td>
                <td className="px-4 py-3 text-center">
                  <StoreBadge store={c.primaryStore} storeColor={storeColor} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                  該当する顧客が見つかりません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CustomerDetailModal customer={selected} onClose={() => setSelected(null)} onNavigateToHistory={onNavigateToHistory} />
    </>
  );
}
