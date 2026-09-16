import { LayoutDashboard, TrendingUp, Activity, Share2, Trophy, History, Settings } from "lucide-react";
import { FONT_HEAD } from "../constants.js";

export const NAV_ITEMS = [
  { key: "summary", label: "サマリー", icon: LayoutDashboard },
  { key: "revenue", label: "売上分析", icon: TrendingUp },
  { key: "occupancy", label: "稼働率", icon: Activity },
  { key: "channel", label: "導線分析", icon: Share2 },
  { key: "ranking", label: "利用者ランキング", icon: Trophy },
  { key: "recent", label: "利用履歴", icon: History },
  { key: "settings", label: "店舗設定", icon: Settings },
];

export default function Sidebar({ view, onChange }) {
  return (
    <nav
      className="flex md:flex-col flex-row flex-wrap gap-1 md:w-52 md:shrink-0 px-3 py-4 md:py-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #E7E2DB" }}
    >
      <p
        style={{ fontFamily: FONT_HEAD, color: "#8A857D" }}
        className="hidden md:block text-xs px-3 mb-2 tracking-wide"
      >
        LUNAレンタルサロン
      </p>
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="flex items-center gap-2 text-sm px-3 py-2 text-left"
            style={{
              background: active ? "#345953" : "transparent",
              color: active ? "#FAF8F5" : "#6B665F",
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
