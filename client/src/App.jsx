import { useEffect, useRef, useState } from "react";
import { Upload, Download, AlertCircle } from "lucide-react";
import { api } from "./api.js";
import { FONT_BODY, FONT_HEAD } from "./constants.js";
import Sidebar, { NAV_ITEMS } from "./components/Sidebar.jsx";
import SummaryPage from "./components/pages/SummaryPage.jsx";
import RevenuePage from "./components/pages/RevenuePage.jsx";
import OccupancyPage from "./components/pages/OccupancyPage.jsx";
import ChannelPage from "./components/pages/ChannelPage.jsx";
import RankingPage from "./components/pages/RankingPage.jsx";
import RecentPage from "./components/pages/RecentPage.jsx";
import StoreSettings from "./components/StoreSettings.jsx";

const PAGES = {
  summary: SummaryPage,
  revenue: RevenuePage,
  occupancy: OccupancyPage,
  channel: ChannelPage,
  ranking: RankingPage,
  recent: RecentPage,
};

export default function App() {
  const [view, setView] = useState("summary");
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

  const PageComponent = PAGES[view];
  const currentLabel = NAV_ITEMS.find((n) => n.key === view)?.label ?? "";

  return (
    <div style={{ background: "#FAF8F5", color: "#262421", fontFamily: FONT_BODY, minHeight: "100vh" }} className="flex flex-col md:flex-row">
      <Sidebar view={view} onChange={setView} />

      <div className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <p style={{ color: "#8A857D", letterSpacing: "0.02em" }} className="text-sm mb-1">
              店舗運営ダッシュボード
            </p>
            <h1 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-2xl md:text-3xl font-bold">
              {currentLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {dashboard?.years?.length > 0 && (
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

        {!loading && view === "settings" && <StoreSettings onChanged={() => loadDashboard(selectedYear)} />}

        {!loading && view !== "settings" && dashboard && dashboard.year && <PageComponent data={dashboard} />}

        {!loading && view !== "settings" && dashboard && !dashboard.year && (
          <p style={{ color: "#8A857D" }} className="text-sm py-12 text-center">
            {dashboard.message || "データがありません。"}
          </p>
        )}
      </div>
    </div>
  );
}
