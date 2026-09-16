import { LayoutDashboard, TrendingUp, Activity, Share2, Trophy, Users, History, Settings } from "lucide-react";

export const NAV_ITEMS = [
  { key: "summary", label: "サマリー", icon: LayoutDashboard },
  { key: "revenue", label: "売上分析", icon: TrendingUp },
  { key: "occupancy", label: "稼働率", icon: Activity },
  { key: "channel", label: "導線分析", icon: Share2 },
  { key: "ranking", label: "利用者ランキング", icon: Trophy },
  { key: "customers", label: "顧客分析", icon: Users },
  { key: "recent", label: "利用履歴", icon: History },
  { key: "settings", label: "店舗設定", icon: Settings },
];

export default function Sidebar({ view, onChange }) {
  return (
    <nav
      className="flex md:flex-col flex-row flex-wrap gap-1 md:w-52 md:shrink-0 px-3 py-4 md:py-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #EDE3D5" }}
    >
      <img src="/logo.png" alt="LUNAレンタルサロン" className="w-full max-w-[180px] h-auto px-2 mb-2" />
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex items-center gap-2 text-sm px-3 py-2 text-left"
            style={{
              background: active ? "#D4A644" : "transparent",
              color: active ? "#262421" : "#7A6A5C",
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
