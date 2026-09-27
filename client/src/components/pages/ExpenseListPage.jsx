import { useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { api } from "../../api.js";
import { FONT_HEAD, yen, makeStoreColor } from "../../constants.js";
import StoreBadge from "../StoreBadge.jsx";

const PAGE_SIZE = 100;

const EMPTY_FORM = { date: "", category: "", store: "", amount: "", description: "" };

export default function ExpenseListPage({ data }) {
  const storeColor = makeStoreColor(data?.storeMeta);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState({ categories: [], stores: [] });
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    api.getExpenseFilters().then(setFilters).catch(() => {});
  }, []);

  function load(params, offsetArg) {
    api
      .getExpenses({ ...params, offset: offsetArg || undefined })
      .then(setResult)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load({ start, end, category, store }, offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  function handleSearch(e) {
    e.preventDefault();
    setOffset(0);
    load({ start, end, category, store }, 0);
  }

  function handleClear() {
    setStart("");
    setEnd("");
    setCategory("");
    setStore("");
    setOffset(0);
    load({}, 0);
  }

  async function handleDelete(id) {
    await api.deleteExpense(id);
    load({ start, end, category, store }, offset);
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setFormError(null);
    if (!form.date || !form.category || !form.amount) {
      setFormError("日付・勘定科目・金額は必須です。");
      return;
    }
    try {
      await api.createExpense({
        date: form.date,
        category: form.category,
        store: form.store || null,
        amount: Number(form.amount),
        description: form.description,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load({ start, end, category, store }, offset);
    } catch (err) {
      setFormError(err.message);
    }
  }

  const hasFilters = start || end || category || store;
  const selectClass = "text-sm px-3 py-2 border";
  const selectStyle = { borderColor: "#EDE3D5", background: "#FFFFFF" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold">
          経費一覧
        </h3>
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={selectClass} style={selectStyle} />
          <span style={{ color: "#8F7D6E" }}>〜</span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={selectClass} style={selectStyle} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">勘定科目(すべて)</option>
            {filters.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={store} onChange={(e) => setStore(e.target.value)} className={selectClass} style={selectStyle}>
            <option value="">店舗(すべて)</option>
            {filters.stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-sm px-3 py-2 border"
            style={{ borderColor: "#EDE3D5", color: "#7A6A5C", background: "#FFFFFF" }}
          >
            <Plus size={14} />
            手動で追加
          </button>
        </form>
      </div>

      {showForm && (
        <form onSubmit={handleAddSubmit} className="flex items-center gap-2 flex-wrap mb-4 p-4" style={{ background: "#FFFFFF" }}>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={selectClass}
            style={selectStyle}
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={selectClass}
            style={selectStyle}
          >
            <option value="">勘定科目を選択</option>
            {filters.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={form.store}
            onChange={(e) => setForm({ ...form, store: e.target.value })}
            className={selectClass}
            style={selectStyle}
          >
            <option value="">店舗(全社共通)</option>
            {filters.stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="金額"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className={selectClass}
            style={{ ...selectStyle, width: 120 }}
          />
          <input
            type="text"
            placeholder="内容(任意)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={selectClass}
            style={{ ...selectStyle, flex: 1, minWidth: 160 }}
          />
          <button type="submit" className="text-sm px-3 py-2" style={{ background: "#D4A644", color: "#262421" }}>
            追加
          </button>
          {formError && (
            <p className="text-sm w-full" style={{ color: "#A84434" }}>
              {formError}
            </p>
          )}
        </form>
      )}

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
          <div style={{ background: "#FFFFFF" }} className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    日付
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    勘定科目
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    店舗
                  </th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    金額
                  </th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}>
                    内容
                  </th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: "#8F7D6E" }}></th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                    <td className="px-4 py-3 text-center">{r.date}</td>
                    <td className="px-4 py-3 text-center">{r.category}</td>
                    <td className="px-4 py-3 text-center">{r.store ? <StoreBadge store={r.store} storeColor={storeColor} /> : "—"}</td>
                    <td className="px-4 py-3 text-right">{yen(r.amount)}</td>
                    <td className="px-4 py-3 text-left" style={{ color: "#7A6A5C" }}>
                      {r.description}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => handleDelete(r.id)} style={{ color: "#A84434" }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                      該当する経費が見つかりません。
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
