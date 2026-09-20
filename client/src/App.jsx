import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { api } from "./api.js";
import { FONT_BODY, FONT_HEAD } from "./constants.js";
import Sidebar, { NAV_ITEMS } from "./components/Sidebar.jsx";
import SummaryPage from "./components/pages/SummaryPage.jsx";
import RevenuePage from "./components/pages/RevenuePage.jsx";
import OccupancyPage from "./components/pages/OccupancyPage.jsx";
import ChannelPage from "./components/pages/ChannelPage.jsx";
import RankingPage from "./components/pages/RankingPage.jsx";
import DailyTrendsPage from "./components/pages/DailyTrendsPage.jsx";
import CustomerPage from "./components/pages/CustomerPage.jsx";
import CustomerListPage from "./components/pages/CustomerListPage.jsx";
import RecentPage from "./components/pages/RecentPage.jsx";
import SettingsPage from "./components/pages/SettingsPage.jsx";
import LoginPage from "./components/LoginPage.jsx";

// 顧客一覧/利用履歴は全期間の累計データを見る、または独自の日付範囲フィルタを
// 持つページで、年度による絞り込みを行わない(dashboardのyearを使わず、
// api.getCustomers()/api.searchTransactions()で直接取得する)ため、
// 年度セレクタを表示しない。
const YEAR_SELECTOR_HIDDEN_VIEWS = new Set(["customerList", "recent", "daily"]);

const PAGES = {
  summary: SummaryPage,
  daily: DailyTrendsPage,
  revenue: RevenuePage,
  occupancy: OccupancyPage,
  channel: ChannelPage,
  ranking: RankingPage,
  customers: CustomerPage,
  customerList: CustomerListPage,
  recent: RecentPage,
};

export default function App() {
  const [view, setView] = useState("summary");
  const [dashboard, setDashboard] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authenticated, setAuthenticated] = useState(null);

  async function loadDashboard(year) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDashboard(year);
      setDashboard(data);
      setSelectedYear(data.year);
      setAuthenticated(true);
    } catch (err) {
      if (err.status === 401) {
        setAuthenticated(false);
      } else {
        setError(err.message);
      }
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

  const PageComponent = PAGES[view];
  const currentLabel = NAV_ITEMS.find((n) => n.key === view)?.label ?? "";

  if (authenticated === false) {
    return <LoginPage onSuccess={() => loadDashboard(undefined)} />;
  }

  return (
    <div style={{ background: "#FCF8F0", color: "#262421", fontFamily: FONT_BODY, minHeight: "100vh" }} className="flex flex-col md:flex-row">
      <Sidebar view={view} onChange={setView} />

      <div className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">
        <div className="flex flex-row items-center justify-between gap-3 mb-6">
          <div className="min-w-0">
            <p style={{ color: "#8F7D6E", letterSpacing: "0.02em" }} className="text-sm mb-1">
              店舗運営ダッシュボード
            </p>
            <h1 style={{ fontFamily: FONT_HEAD, color: "#262421" }} className="text-2xl md:text-3xl font-bold truncate">
              {currentLabel}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {dashboard?.years?.length > 0 && !YEAR_SELECTOR_HIDDEN_VIEWS.has(view) && (
              <select
                value={selectedYear ?? ""}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="text-sm px-3 py-2 border"
                style={{ borderColor: "#EDE3D5", color: "#262421", background: "#FFFFFF" }}
              >
                {dashboard.years.map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm mb-6 px-4 py-3" style={{ background: "#FCEEE7", color: "#A84434" }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && <p style={{ color: "#8F7D6E" }}>読み込み中…</p>}

        {!loading && view === "settings" && <SettingsPage onDataChanged={() => loadDashboard(selectedYear)} />}

        {!loading && view !== "settings" && dashboard && dashboard.year && <PageComponent data={dashboard} />}

        {!loading && view !== "settings" && dashboard && !dashboard.year && (
          <p style={{ color: "#8F7D6E" }} className="text-sm py-12 text-center">
            {dashboard.message || "データがありません。"}
          </p>
        )}
      </div>
    </div>
  );
}
