import { useEffect, useState } from "react";
import { Check, Trash2, Plus, AlertCircle } from "lucide-react";
import { api } from "../api.js";

const EMPTY_NEW_EVENT = { startDate: "", endDate: "", stores: "", note: "" };

const inputStyle = { borderColor: "#EDE3D5" };
const inputClass = "text-sm px-2 py-1.5 border w-full";

export default function BusinessEventsSection() {
  const [events, setEvents] = useState(null);
  const [error, setError] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [newEvent, setNewEvent] = useState(EMPTY_NEW_EVENT);

  async function load() {
    setError(null);
    try {
      const { events } = await api.getBusinessEvents();
      setEvents(events);
      setDrafts(
        Object.fromEntries(
          events.map((e) => [e.id, { startDate: e.start_date, endDate: e.end_date, stores: e.stores || "", note: e.note }])
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
      const draft = drafts[id];
      await api.updateBusinessEvent(id, draft);
      setSavedId(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(id) {
    setError(null);
    try {
      await api.deleteBusinessEvent(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function add() {
    setError(null);
    if (!newEvent.startDate || !newEvent.endDate || !newEvent.note.trim()) return;
    try {
      await api.createBusinessEvent(newEvent);
      setNewEvent(EMPTY_NEW_EVENT);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!events) return null;

  return (
    <div>
      <p style={{ color: "#8F7D6E" }} className="text-sm mb-6">
        工事による休業や新店オープンなど、集計だけでは分からない出来事を記録しておくと、「サマリー」下部の自動総括に反映されます(該当月の売上変動を機械的な「好調/要注意」ではなく、この内容で説明します)。対象店舗は空欄で全店舗、複数店舗はカンマ区切り(例: Bellezza,Forest)。
      </p>

      {error && (
        <div className="flex items-start gap-2 text-sm mb-6 px-4 py-3" style={{ background: "#FCEEE7", color: "#A84434" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div style={{ background: "#FFFFFF" }} className="overflow-x-auto mb-3">
        <table className="min-w-[760px] w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
              <th className="text-left px-4 py-2 font-medium w-32" style={{ color: "#8F7D6E" }}>
                開始日
              </th>
              <th className="text-left px-4 py-2 font-medium w-32" style={{ color: "#8F7D6E" }}>
                終了日
              </th>
              <th className="text-left px-4 py-2 font-medium w-40" style={{ color: "#8F7D6E" }}>
                対象店舗
              </th>
              <th className="text-left px-4 py-2 font-medium min-w-[180px]" style={{ color: "#8F7D6E" }}>
                内容
              </th>
              <th className="text-center px-4 py-2 font-medium w-32" style={{ color: "#8F7D6E" }}>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const draft = drafts[e.id] || { startDate: e.start_date, endDate: e.end_date, stores: e.stores || "", note: e.note };
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(ev) => setDraft(e.id, { startDate: ev.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="date"
                      value={draft.endDate}
                      onChange={(ev) => setDraft(e.id, { endDate: ev.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={draft.stores}
                      onChange={(ev) => setDraft(e.id, { stores: ev.target.value })}
                      placeholder="全店舗"
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={draft.note}
                      onChange={(ev) => setDraft(e.id, { note: ev.target.value })}
                      className={inputClass}
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => save(e.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1.5"
                        style={{ background: "#D4A644", color: "#262421" }}
                      >
                        {savedId === e.id ? <Check size={13} /> : null}
                        保存
                      </button>
                      <button
                        onClick={() => remove(e.id)}
                        aria-label="削除"
                        className="p-1.5"
                        style={{ color: "#A84434", border: "1px solid #EDE3D5" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "#8F7D6E" }}>
                  登録されている出来事はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={newEvent.startDate}
          onChange={(e) => setNewEvent((d) => ({ ...d, startDate: e.target.value }))}
          className="text-sm px-2 py-1.5 border"
          style={inputStyle}
        />
        <input
          type="date"
          value={newEvent.endDate}
          onChange={(e) => setNewEvent((d) => ({ ...d, endDate: e.target.value }))}
          className="text-sm px-2 py-1.5 border"
          style={inputStyle}
        />
        <input
          type="text"
          value={newEvent.stores}
          onChange={(e) => setNewEvent((d) => ({ ...d, stores: e.target.value }))}
          placeholder="対象店舗(空欄=全店舗)"
          className="text-sm px-2 py-1.5 border w-44"
          style={inputStyle}
        />
        <input
          type="text"
          value={newEvent.note}
          onChange={(e) => setNewEvent((d) => ({ ...d, note: e.target.value }))}
          placeholder="内容(例: 設備工事のため休業)"
          className="text-sm px-2 py-1.5 border w-64"
          style={inputStyle}
        />
        <button
          onClick={add}
          className="flex items-center gap-1 text-sm px-3 py-1.5"
          style={{ background: "#EDE3D5", color: "#262421" }}
        >
          <Plus size={14} />
          追加
        </button>
      </div>
    </div>
  );
}
