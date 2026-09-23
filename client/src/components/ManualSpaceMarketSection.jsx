import { useEffect, useState } from "react";
import { Check, Trash2, Plus, AlertCircle } from "lucide-react";
import { api } from "../api.js";
import { yen, formatDuration } from "../constants.js";
import { useKnownUserNames } from "../hooks/useKnownUserNames.js";

const EMPTY_ENTRY = { date: "", store: "", userName: "", status: "利用済み", startTime: "", endTime: "", revenue: "", bookingDate: "" };

const inputStyle = { borderColor: "#EDE3D5" };
const inputClass = "text-sm px-2 py-1.5 border w-full";

function toTimeString(hour, minute) {
  if (hour == null) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute ?? 0).padStart(2, "0")}`;
}

// 保存されているのは開始時刻+利用時間(hours_used)のみなので、編集フォーム用に
// 終了時刻を逆算する。hours_usedが0(取消など)の行は空欄のままにする。
function toEndTimeString(hour, minute, hoursUsed) {
  if (hour == null || !hoursUsed) return "";
  const totalStart = hour * 60 + (minute ?? 0);
  const wrapped = (totalStart + Math.round(hoursUsed * 60)) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function EntryFields({ value, onChange, storeNames, statuses }) {
  return (
    <>
      <input type="date" value={value.date} onChange={(e) => onChange({ date: e.target.value })} className={inputClass} style={inputStyle} />
      <select value={value.store} onChange={(e) => onChange({ store: e.target.value })} className={inputClass} style={inputStyle}>
        <option value="">店舗を選択</option>
        {storeNames.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        type="text"
        list="manual-space-market-user-names"
        value={value.userName}
        onChange={(e) => onChange({ userName: e.target.value })}
        placeholder="苗字を入力すると候補表示"
        className={inputClass}
        style={inputStyle}
      />
      <select value={value.status} onChange={(e) => onChange({ status: e.target.value })} className={inputClass} style={inputStyle}>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input type="time" value={value.startTime} onChange={(e) => onChange({ startTime: e.target.value })} className={inputClass} style={inputStyle} />
      <input type="time" value={value.endTime} onChange={(e) => onChange({ endTime: e.target.value })} className={inputClass} style={inputStyle} />
      <input
        type="number"
        value={value.revenue}
        onChange={(e) => onChange({ revenue: e.target.value })}
        placeholder="売上(円)"
        className={inputClass}
        style={inputStyle}
      />
      <input type="date" value={value.bookingDate} onChange={(e) => onChange({ bookingDate: e.target.value })} className={inputClass} style={inputStyle} />
    </>
  );
}

export default function ManualSpaceMarketSection() {
  const userNames = useKnownUserNames();
  const [transactions, setTransactions] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [storeNames, setStoreNames] = useState([]);
  const [error, setError] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newEntry, setNewEntry] = useState(EMPTY_ENTRY);

  async function load() {
    setError(null);
    try {
      const [{ transactions, statuses }, { stores }] = await Promise.all([
        api.getManualSpaceMarketTransactions(),
        api.getStoreSettings(),
      ]);
      setTransactions(transactions);
      setStatuses(statuses);
      setStoreNames(stores.map((s) => s.store));
      setDrafts(
        Object.fromEntries(
          transactions.map((t) => [
            t.id,
            {
              date: t.date,
              store: t.store,
              userName: t.user_name,
              status: t.status,
              startTime: toTimeString(t.start_hour, t.start_minute),
              endTime: toEndTimeString(t.start_hour, t.start_minute, t.hours_used),
              revenue: t.revenue,
              bookingDate: t.booking_date || "",
            },
          ])
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setDraft(id, patch) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function save(id) {
    setError(null);
    setSavedId(null);
    try {
      await api.updateManualSpaceMarketTransaction(id, drafts[id]);
      setSavedId(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await api.deleteManualSpaceMarketTransaction(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function add() {
    setError(null);
    if (!newEntry.date || !newEntry.store || !newEntry.userName.trim() || newEntry.revenue === "") return;
    try {
      await api.createManualSpaceMarketTransaction(newEntry);
      setNewEntry(EMPTY_ENTRY);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!transactions) return null;

  return (
    <div>
      <p style={{ color: "#8F7D6E" }} className="text-sm mb-6">
        スペースマーケットは予約数が少ないため、CSV取り込みではなくここで手動登録します。開始・終了時間を入れると利用時間が自動計算されます。
      </p>

      <datalist id="manual-space-market-user-names">
        {userNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {error && (
        <div className="flex items-start gap-2 text-sm mb-6 px-4 py-3" style={{ background: "#FCEEE7", color: "#A84434" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto mb-3">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
              <th className="text-left px-3 py-2 font-medium w-36" style={{ color: "#8F7D6E" }}>
                利用日
              </th>
              <th className="text-left px-3 py-2 font-medium w-32" style={{ color: "#8F7D6E" }}>
                店舗
              </th>
              <th className="text-left px-3 py-2 font-medium w-40" style={{ color: "#8F7D6E" }}>
                利用者名
              </th>
              <th className="text-left px-3 py-2 font-medium w-36" style={{ color: "#8F7D6E" }}>
                状態
              </th>
              <th className="text-left px-3 py-2 font-medium w-28" style={{ color: "#8F7D6E" }}>
                開始時間
              </th>
              <th className="text-left px-3 py-2 font-medium w-28" style={{ color: "#8F7D6E" }}>
                終了時間
              </th>
              <th className="text-left px-3 py-2 font-medium w-28" style={{ color: "#8F7D6E" }}>
                売上
              </th>
              <th className="text-left px-3 py-2 font-medium w-36" style={{ color: "#8F7D6E" }}>
                予約日(任意)
              </th>
              <th className="text-center px-3 py-2 font-medium" style={{ color: "#8F7D6E" }}>
                利用時間
              </th>
              <th className="text-center px-3 py-2 font-medium w-32" style={{ color: "#8F7D6E" }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const draft = drafts[t.id];
              if (!draft) return null;
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-3 py-2">
                    <input type="date" value={draft.date} onChange={(e) => setDraft(t.id, { date: e.target.value })} className={inputClass} style={inputStyle} />
                  </td>
                  <td className="px-3 py-2">
                    <select value={draft.store} onChange={(e) => setDraft(t.id, { store: e.target.value })} className={inputClass} style={inputStyle}>
                      {storeNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      list="manual-space-market-user-names"
                      value={draft.userName}
                      onChange={(e) => setDraft(t.id, { userName: e.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select value={draft.status} onChange={(e) => setDraft(t.id, { status: e.target.value })} className={inputClass} style={inputStyle}>
                      {statuses.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" value={draft.startTime} onChange={(e) => setDraft(t.id, { startTime: e.target.value })} className={inputClass} style={inputStyle} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="time"
                      value={draft.endTime}
                      onChange={(e) => setDraft(t.id, { endTime: e.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={draft.revenue} onChange={(e) => setDraft(t.id, { revenue: e.target.value })} className={inputClass} style={inputStyle} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      value={draft.bookingDate}
                      onChange={(e) => setDraft(t.id, { bookingDate: e.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">{formatDuration(t.hours_used)} / {yen(t.revenue)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => save(t.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1.5"
                        style={{ background: "#D4A644", color: "#262421" }}
                      >
                        {savedId === t.id ? <Check size={13} /> : null}
                        保存
                      </button>
                      <button onClick={() => remove(t.id)} aria-label="削除" className="p-1.5" style={{ color: "#A84434", border: "1px solid #EDE3D5" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center" style={{ color: "#8F7D6E" }}>
                  手動登録された実績はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs mb-6" style={{ color: "#8F7D6E" }}>
        終了時間を空欄のまま保存すると、利用時間の計算には反映されません(開始・終了の両方を入力してください)。
      </p>

      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto p-3">
        <p style={{ color: "#8F7D6E" }} className="text-xs mb-2">
          新規登録
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <EntryFields value={newEntry} onChange={(patch) => setNewEntry((d) => ({ ...d, ...patch }))} storeNames={storeNames} statuses={statuses} />
        </div>
        <button onClick={add} className="flex items-center gap-1 text-sm px-3 py-1.5" style={{ background: "#EDE3D5", color: "#262421" }}>
          <Plus size={14} />
          追加
        </button>
      </div>
    </div>
  );
}
