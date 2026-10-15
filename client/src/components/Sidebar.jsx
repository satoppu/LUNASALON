import { useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  Share2,
  Users,
  Contact,
  History,
  Settings,
  CalendarDays,
  ListChecks,
  Wallet,
  ChevronDown,
} from "lucide-react";

// 収支だけはサブメニュー(月次収支/経費一覧)を持つ — 複数の切り口があるため、
// 1ページに詰め込まず分けた方が分かりやすい。他の項目はこれまで通り単一
// ページのまま(childrenを持たない)。
export const NAV_ITEMS = [
  { key: "summary", label: "サマリー", icon: LayoutDashboard },
  { key: "daily", label: "日次動向", icon: CalendarDays },
  { key: "revenue", label: "売上分析", icon: TrendingUp },
  { key: "occupancy", label: "稼働率", icon: Activity },
  { key: "customers", label: "顧客分析", icon: Users },
  { key: "customerList", label: "顧客一覧", icon: Contact },
  { key: "recent", label: "利用履歴", icon: History },
  { key: "channel", label: "導線分析", icon: Share2 },
  { key: "reference", label: "提供一覧", icon: ListChecks },
  {
    key: "expenses",
    label: "収支",
    icon: Wallet,
    children: [
      { key: "expenseSummary", label: "月次収支" },
      { key: "expenseList", label: "経費一覧" },
    ],
  },
  { key: "settings", label: "設定", icon: Settings },
];

// key(サブメニュー項目自身のkey) -> 親項目のkey。App.jsx側でどのviewが
// どのグループに属するか気にせずに済むよう、ここで一度だけ組み立てる。
const PARENT_BY_CHILD_KEY = Object.fromEntries(
  NAV_ITEMS.flatMap((item) => (item.children ? item.children.map((c) => [c.key, item.key]) : []))
);

export default function Sidebar({ view, onChange }) {
  const activeParentKey = PARENT_BY_CHILD_KEY[view];
  const [openGroup, setOpenGroup] = useState(activeParentKey || null);

  return (
    <nav
      className="flex md:flex-col flex-row flex-wrap gap-1 md:w-52 md:shrink-0 px-3 py-4 md:py-6"
      style={{ background: "#FFFFFF", borderBottom: "1px solid #EDE3D5" }}
    >
      <img src="/logo.png" alt="LUNAレンタルサロン" className="w-full max-w-[180px] h-auto px-2 mb-2" />
      {NAV_ITEMS.map(({ key, label, icon: Icon, children }) => {
        if (!children) {
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
        }

        const groupActive = activeParentKey === key;
        const isOpen = openGroup === key;
        return (
          <div key={key} className="flex flex-col w-full">
            <button
              onClick={() => setOpenGroup(isOpen ? null : key)}
              className="flex items-center gap-2 text-sm px-3 py-2 text-left"
              style={{
                background: groupActive && !isOpen ? "#D4A644" : "transparent",
                color: groupActive ? "#262421" : "#7A6A5C",
              }}
            >
              <Icon size={16} />
              {label}
              <ChevronDown size={14} className="ml-auto transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : undefined }} />
            </button>
            {isOpen && (
              <div className="flex flex-col ml-6">
                {children.map((child) => {
                  const active = view === child.key;
                  return (
                    <button
                      key={child.key}
                      onClick={() => onChange(child.key)}
                      className="text-sm px-3 py-2 text-left"
                      style={{
                        background: active ? "#D4A644" : "transparent",
                        color: active ? "#262421" : "#7A6A5C",
                      }}
                    >
                      {child.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
