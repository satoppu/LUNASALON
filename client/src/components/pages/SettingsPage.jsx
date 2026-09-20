import { useRef, useState } from "react";
import { Upload, AlertCircle } from "lucide-react";
import { api } from "../../api.js";
import { FONT_HEAD } from "../../constants.js";
import { NAV_ITEMS } from "../Sidebar.jsx";
import StoreSettings from "../StoreSettings.jsx";
import PageNotes from "../PageNotes.jsx";
import CabinetsPage from "./CabinetsPage.jsx";
import BusinessEventsSection from "../BusinessEventsSection.jsx";

const NOTE_PAGES = NAV_ITEMS.filter((n) => n.key !== "settings");

const TABS = [
  { key: "settings", label: "設定" },
  { key: "registry", label: "登録情報" },
];

function describeImportResult(result) {
  const parts = [`${result.inserted}件のデータを取り込みました。`];
  if (result.updated) parts.push(`${result.updated}件は状況が更新されました(例: 利用前→利用済み)。`);
  if (result.skippedAlreadyCovered) parts.push(`${result.skippedAlreadyCovered}件は既に取り込み済みのためスキップしました。`);
  if (result.skippedUnparseable) parts.push(`${result.skippedUnparseable}件は読み取れませんでした。`);
  if (result.unresolvedOrBad) parts.push(`${result.unresolvedOrBad}件は利用実績がなく店舗を特定できないため保留しました。`);
  if (result.skipped) parts.push(`${result.skipped}件は列が読み取れずスキップしました。`);
  if (result.duplicates) parts.push(`(うち${result.duplicates}件は取り込み済みでした)`);
  return parts.join(" ");
}

export default function SettingsPage({ onDataChanged }) {
  const [tab, setTab] = useState("settings");
  const [importMessage, setImportMessage] = useState(null);
  const [error, setError] = useState(null);
  const [notePageKey, setNotePageKey] = useState(NOTE_PAGES[0].key);
  const fileInput = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setError(null);
    try {
      const result = await api.importCsv(file);
      setImportMessage(describeImportResult(result));
      onDataChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div>
      <div className="flex gap-1 mb-8">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className="text-sm px-4 py-2"
            style={{
              background: tab === t.key ? "#D4A644" : "#FFFFFF",
              color: tab === t.key ? "#262421" : "#7A6A5C",
              border: "1px solid #EDE3D5",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && (
        <div>
          <section className="mb-12">
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
              データ取り込み
            </h3>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 text-sm px-3 py-2"
              style={{ background: "#D4A644", color: "#262421" }}
            >
              <Upload size={15} />
              インポート
            </button>
            <input ref={fileInput} type="file" accept=".csv,.zip,.xlsx,.xls" onChange={handleFile} className="hidden" />

            {importMessage && (
              <p className="text-sm mt-4" style={{ color: "#7A6A5C" }}>
                {importMessage}
              </p>
            )}
            {error && (
              <div className="flex items-start gap-2 text-sm mt-4 px-4 py-3" style={{ background: "#FCEEE7", color: "#A84434" }}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </section>

          <section>
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
              店舗設定
            </h3>
            <StoreSettings onChanged={onDataChanged} />
          </section>
        </div>
      )}

      {tab === "registry" && (
        <div>
          <section className="mb-12">
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
              キャビネット・クーポン
            </h3>
            <CabinetsPage />
          </section>

          <section className="mb-12">
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
              出来事メモ
            </h3>
            <BusinessEventsSection />
          </section>

          <section>
            <h3 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-base font-bold mb-4">
              振り返り・やる事メモ
            </h3>
            <select
              value={notePageKey}
              onChange={(e) => setNotePageKey(e.target.value)}
              className="text-sm px-3 py-2 border mb-4"
              style={{ borderColor: "#EDE3D5", background: "#FFFFFF" }}
            >
              {NOTE_PAGES.map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label}
                </option>
              ))}
            </select>
            <PageNotes pageKey={notePageKey} />
          </section>
        </div>
      )}
    </div>
  );
}
