import { useEffect, useRef, useState } from "react";
import { Upload, Download, AlertCircle, Settings, LayoutDashboard } from "lucide-react";
import { api } from "./api.js";
import { FONT_BODY, FONT_HEAD } from "./constants.js";
import Dashboard from "./components/Dashboard.jsx";
import StoreSettings from "./components/StoreSettings.jsx";

export default function App() {
  const [view, setView] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importMessage, setImportMessage] = useState(null);
  const fileInput = useRef(null);

  async function loadDashboard(year) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard(year);
      setDashboard(data);
      setSelectedYear(data.year);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(undefined);
  }, []);

  async function handleYearChange(y) {
    setSelectedYear(y);
    await loadDashboard(y);
  }

  function describeImportResult(result) {
    const parts = [`${result.inserted}件のデータを取り込みました。`];
    if (result.format === "rawBooking") {
      if (result.skippedPending) parts.push(`未確定の予約 ${result.skippedPending}件は対象外(実施後に再度アップロードしてください)。`);
      if (result.skippedAlreadyCovered) parts.push(`${result.skippedAlreadyCovered}件は既に取り込み済みの期間のためスキップしました。`);
      if (result.skippedUnparseable) parts.push(`${result.skippedUnparseable}件は読み取れませんでした。`);
    } else if (result.format === "rawSubscription") {
      if (result.skippedAlreadyCovered) parts.push(`${result.skippedAlreadyCovered}件は既に取り込み済みの期間のためスキップしました。`);
      if (result.unresolvedOrBad) parts.push(`${result.unresolvedOrBad}件は利用実績がなく店舗を特定できないため保留しました。`);
    } else if (result.skipped) {
      parts.push(`${result.skipped}件は列が読み取れずスキップしました。`);
    }
    if (result.duplicates) parts.push(`(うち${result.duplicates}件は取り込み済みでした)`);
    return parts.join(" ");
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMessage(null);
    setError(null);
    try {
      const result = await api.importCsv(file);
      setImportMessage(describeImportResult(result));
      await loadDashboard(selectedYear);
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  }

  return (
    <div style={{ background: "#FAF8F5", color: "#262421", fontFamily: FONT_BODY, minHeight: "100vh" }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p style={{ color: "#8A857D", letterSpacing: "0.02em" }} className="text-sm mb-1">
              LUNAレンタルサロン
            </p>
            <h1 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-3xl md:text-4xl font-bold">
              店舗運営ダッシュボード
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {view === "dashboard" && dashboard?.years?.length > 0 && (
              <select
                value={selectedYear ?? ""}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="text-sm px-3 py-2 border"
                style={{ borderColor: "#E7E2DB", color: "#262421", background: "#FFFFFF" }}
              >
                {dashboard.years.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            )}
            <a
              href={api.templateUrl}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border"
              style={{ borderColor: "#E7E2DB", color: "#6B665F", background: "#FFFFFF" }}
            >
              <Download size={15} />
              テンプレートDL
            </a>
            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 text-sm px-3 py-2"
              style={{ background: "#345953", color: "#FAF8F5" }}
            >
              <Upload size={15} />
              CSVインポート
            </button>
            <input ref={fileInput} type="file" accept=".csv" onChange={handleFile} className="hidden" />
            <button
              onClick={() => setView(view === "dashboard" ? "settings" : "dashboard")}
              className="flex items-center gap-1.5 text-sm px-3 py-2 border"
              style={{ borderColor: "#E7E2DB", color: "#6B665F", background: "#FFFFFF" }}
            >
              {view === "dashboard" ? <Settings size={15} /> : <LayoutDashboard size={15} />}
              {view === "dashboard" ? "店舗設定" : "ダッシュボードに戻る"}
            </button>
          </div>
        </div>

        {importMessage && (
          <p className="text-sm mb-4" style={{ color: "#6B665F" }}>
            {importMessage}
          </p>
        )}
        {error && (
          <div className="flex items-start gap-2 text-sm mb-6 px-4 py-3" style={{ background: "#FBEFEF", color: "#8C3B3B" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && <p style={{ color: "#8A857D" }}>読み込み中…</p>}

        {!loading && view === "settings" && (
          <StoreSettings onChanged={() => loadDashboard(selectedYear)} />
        )}

        {!loading && view === "dashboard" && dashboard && dashboard.year && (
          <Dashboard data={dashboard} />
        )}

        {!loading && view === "dashboard" && dashboard && !dashboard.year && (
          <p style={{ color: "#8A857D" }} className="text-sm py-12 text-center">
            {dashboard.message || "データがありません。"}
          </p>
        )}
      </div>
    </div>
  );
}
