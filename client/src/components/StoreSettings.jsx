import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { api } from "../api.js";
import { FONT_HEAD } from "../constants.js";

export default function StoreSettings({ onChanged }) {
  const [stores, setStores] = useState(null);
  const [error, setError] = useState(null);
  const [savedStore, setSavedStore] = useState(null);
  const [drafts, setDrafts] = useState({});

  async function load() {
    setError(null);
    try {
      const { stores } = await api.getStoreSettings();
      setStores(stores);
      setDrafts(
        Object.fromEntries(
          stores.map((s) => [
            s.store,
            { openDate: s.open_date || "", operatingHoursPerDay: s.operating_hours_per_day },
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

  function setDraft(store, patch) {
    setDrafts((d) => ({ ...d, [store]: { ...d[store], ...patch } }));
  }

  async function save(store) {
    setError(null);
    setSavedStore(null);
    try {
      const draft = drafts[store];
      await api.updateStoreSetting(store, {
        openDate: draft.openDate || null,
        operatingHoursPerDay: Number(draft.operatingHoursPerDay),
      });
      setSavedStore(store);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!stores) return null;

  return (
    <div className="mb-12">
      <p style={{ color: "#8F7B82" }} className="text-sm mb-6">
        営業開始日と1日あたりの稼働可能時間はここで管理します。営業開始日を空欄にすると、実績データ上の初回利用日から自動推定されます。
      </p>

      {error && (
        <div className="flex items-start gap-2 text-sm mb-6 px-4 py-3" style={{ background: "#FBEFEF", color: "#A83A56" }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stores.map((s) => {
          const draft = drafts[s.store] || {};
          return (
            <div key={s.store} style={{ background: "#FFFFFF", borderLeft: `4px solid ${s.color || "#8F7B82"}` }} className="px-6 py-5">
              <div className="flex items-baseline justify-between mb-4">
                <h3 style={{ fontFamily: FONT_HEAD }} className="text-lg font-bold">
                  {s.store}
                </h3>
                {s.area && (
                  <span style={{ color: "#8F7B82" }} className="text-xs">
                    {s.area}
                  </span>
                )}
              </div>

              <label className="block text-xs mb-1" style={{ color: "#8F7B82" }}>
                営業開始日(空欄=自動推定)
              </label>
              <input
                type="date"
                value={draft.openDate}
                onChange={(e) => setDraft(s.store, { openDate: e.target.value })}
                className="w-full text-sm px-3 py-2 border mb-4"
                style={{ borderColor: "#EAE0E3" }}
              />

              <label className="block text-xs mb-1" style={{ color: "#8F7B82" }}>
                1日あたり稼働可能時間(h)
              </label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={draft.operatingHoursPerDay}
                onChange={(e) => setDraft(s.store, { operatingHoursPerDay: e.target.value })}
                className="w-full text-sm px-3 py-2 border mb-4"
                style={{ borderColor: "#EAE0E3" }}
              />

              <button
                onClick={() => save(s.store)}
                className="flex items-center gap-1.5 text-sm px-3 py-2"
                style={{ background: "#B5306A", color: "#FBF6F7" }}
              >
                {savedStore === s.store ? <Check size={15} /> : null}
                保存
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
