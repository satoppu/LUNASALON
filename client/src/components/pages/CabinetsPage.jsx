import { useEffect, useState } from "react";
import { Check, Trash2, Plus, AlertCircle } from "lucide-react";
import { api } from "../../api.js";
import { FONT_HEAD } from "../../constants.js";
import { useKnownUserNames } from "../../hooks/useKnownUserNames.js";

const USER_NAMES_DATALIST_ID = "cabinets-page-user-names";

const EMPTY_NEW_CABINET = { slotLabel: "", userName: "" };

const inputStyle = { borderColor: "#EDE3D5" };
const inputClass = "text-sm px-2 py-1.5 border w-full";

export default function CabinetsPage() {
  const userNames = useKnownUserNames();
  const [cabinets, setCabinets] = useState(null);
  const [storeNames, setStoreNames] = useState([]);
  const [error, setError] = useState(null);
  const [savedKey, setSavedKey] = useState(null);
  const [cabinetDrafts, setCabinetDrafts] = useState({});
  const [newCabinetDrafts, setNewCabinetDrafts] = useState({});

  async function load() {
    setError(null);
    try {
      const [{ cabinets }, { stores }] = await Promise.all([api.getCabinets(), api.getStoreSettings()]);
      setCabinets(cabinets);
      setStoreNames(stores.map((s) => s.store));
      setCabinetDrafts(
        Object.fromEntries(cabinets.map((c) => [c.id, { slotLabel: c.slot_label, userName: c.user_name || "" }]))
      );
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setCabinetDraft(id, patch) {
    setCabinetDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  async function saveCabinet(id) {
    setError(null);
    setSavedKey(null);
    try {
      const draft = cabinetDrafts[id];
      await api.updateCabinet(id, { slotLabel: draft.slotLabel, userName: draft.userName });
      setSavedKey(`cabinet-${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeCabinet(id) {
    setError(null);
    try {
      await api.deleteCabinet(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCabinet(store) {
    setError(null);
    const draft = newCabinetDrafts[store] || EMPTY_NEW_CABINET;
    if (!draft.slotLabel.trim()) return;
    try {
      await api.createCabinet({ store, slotLabel: draft.slotLabel, userName: draft.userName });
      setNewCabinetDrafts((d) => ({ ...d, [store]: EMPTY_NEW_CABINET }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!cabinets) {
    return <p style={{ color: "#8F7D6E" }}>読み込み中…</p>;
  }

  const cabinetsByStore = new Map();
  for (const c of cabinets) {
    if (!cabinetsByStore.has(c.store)) cabinetsByStore.set(c.store, []);
    cabinetsByStore.get(c.store).push(c);
  }
  const orderedStores = [...storeNames.filter((s) => cabinetsByStore.has(s)), ...[...cabinetsByStore.keys()].filter((s) => !storeNames.includes(s))];
  const addStoreOptions = storeNames.length > 0 ? storeNames : [...cabinetsByStore.keys()];

  return (
    <div>
      <datalist id={USER_NAMES_DATALIST_ID}>
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

      <section>
        <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-2">
          キャビネット利用
        </h3>
        <p style={{ color: "#8F7D6E" }} className="text-sm mb-6">
          店舗ごとの物理キャビネットの番号と、現在の利用者を管理します。利用者を空欄にすると「空き」になります。
        </p>

        {orderedStores.map((store) => (
          <div key={store} className="mb-8">
            <h4 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-sm font-bold mb-3">
              {store}
            </h4>
            <div style={{ background: "#FFFFFF" }} className="overflow-x-auto mb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #EDE3D5" }}>
                    <th className="text-left px-2 py-2 font-medium w-16" style={{ color: "#8F7D6E" }}>
                      番号
                    </th>
                    <th className="text-left px-2 py-2 font-medium" style={{ color: "#8F7D6E" }}>
                      利用者
                    </th>
                    <th className="text-center px-2 py-2 font-medium w-24" style={{ color: "#8F7D6E" }}>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cabinetsByStore.get(store).map((c) => {
                    const draft = cabinetDrafts[c.id] || { slotLabel: c.slot_label, userName: "" };
                    return (
                      <tr key={c.id} style={{ borderBottom: "1px solid #F3EBDF" }}>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={draft.slotLabel}
                            onChange={(e) => setCabinetDraft(c.id, { slotLabel: e.target.value })}
                            className={inputClass}
                            style={inputStyle}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            list={USER_NAMES_DATALIST_ID}
                            value={draft.userName}
                            onChange={(e) => setCabinetDraft(c.id, { userName: e.target.value })}
                            placeholder="空き"
                            className={inputClass}
                            style={{ ...inputStyle, minWidth: 140 }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => saveCabinet(c.id)}
                              className="flex items-center gap-1 text-xs px-2 py-1.5"
                              style={{ background: "#D4A644", color: "#262421" }}
                            >
                              {savedKey === `cabinet-${c.id}` ? <Check size={13} /> : null}
                              保存
                            </button>
                            <button
                              onClick={() => removeCabinet(c.id)}
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
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={(newCabinetDrafts[store] || EMPTY_NEW_CABINET).slotLabel}
                onChange={(e) => setNewCabinetDrafts((d) => ({ ...d, [store]: { ...(d[store] || EMPTY_NEW_CABINET), slotLabel: e.target.value } }))}
                placeholder="番号(例: 8)"
                className="text-sm px-2 py-1.5 border w-32"
                style={inputStyle}
              />
              <input
                type="text"
                list={USER_NAMES_DATALIST_ID}
                value={(newCabinetDrafts[store] || EMPTY_NEW_CABINET).userName}
                onChange={(e) => setNewCabinetDrafts((d) => ({ ...d, [store]: { ...(d[store] || EMPTY_NEW_CABINET), userName: e.target.value } }))}
                placeholder="利用者(空欄=空き)"
                className="text-sm px-2 py-1.5 border w-48"
                style={inputStyle}
              />
              <button
                onClick={() => addCabinet(store)}
                className="flex items-center gap-1 text-sm px-3 py-1.5"
                style={{ background: "#EDE3D5", color: "#262421" }}
              >
                <Plus size={14} />
                追加
              </button>
            </div>
          </div>
        ))}

        {orderedStores.length === 0 && addStoreOptions.length > 0 && (
          <p style={{ color: "#8F7D6E" }} className="text-sm">
            まだキャビネットが登録されていません。
          </p>
        )}
      </section>

    </div>
  );
}
