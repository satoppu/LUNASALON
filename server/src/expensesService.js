// 収支(経費)ページ向けのサービス。既存の売上系(aggregations.js/dashboardService.js)
// とは独立しており、expensesテーブルだけを扱う。売上との突き合わせ(営業利益)
// だけ effectiveRevenue を横断的に再利用する。
import db from "./db.js";
import { effectiveRevenue } from "./aggregations.js";

// 一覧・エクスポート・グラフの並び順の基準になる勘定科目の順序。開業費・
// 設備費(ASTERIA関連の一時費用)は営業利益の計算上「除く/含む」を切り替える
// 対象なので、常に末尾に置いて目立たせる。
export const EXPENSE_CATEGORIES = [
  "家賃",
  "水道光熱費",
  "通信費",
  "消耗品費",
  "保険料",
  "システム利用料",
  "広告宣伝費",
  "支払手数料",
  "雑費",
  "開業費・設備費",
];

export const INITIAL_COST_CATEGORY = "開業費・設備費";

function buildFilterClause({ start, end, category, store }) {
  const clauses = [];
  const params = [];
  if (start) {
    clauses.push("date >= ?");
    params.push(start);
  }
  if (end) {
    clauses.push("date <= ?");
    params.push(end);
  }
  if (category) {
    clauses.push("category = ?");
    params.push(category);
  }
  if (store) {
    clauses.push("store = ?");
    params.push(store);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function listExpenses({ start, end, category, store, limit = 100, offset = 0 } = {}) {
  const { where, params } = buildFilterClause({ start, end, category, store });
  const total = db.prepare(`SELECT COUNT(*) AS c FROM expenses ${where}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM expenses ${where} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  return { rows, total, limit, offset };
}

export function getExpenseFilters() {
  const stores = db
    .prepare(`SELECT DISTINCT store FROM expenses WHERE store IS NOT NULL ORDER BY store`)
    .all()
    .map((r) => r.store);
  const years = db
    .prepare(`SELECT DISTINCT substr(date, 1, 4) AS y FROM expenses ORDER BY y DESC`)
    .all()
    .map((r) => Number(r.y));
  return { categories: EXPENSE_CATEGORIES, stores, years };
}

export function createExpense({ date, category, store, amount, description }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO expenses (date, category, store, amount, description, source) VALUES (?, ?, ?, ?, ?, 'manual')`)
    .run(date, category, store || null, amount, description || "");
  return db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(lastInsertRowid);
}

export function updateExpense(id, { date, category, store, amount, description }) {
  const existing = db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id);
  if (!existing) return null;
  const next = {
    date: date ?? existing.date,
    category: category ?? existing.category,
    store: store !== undefined ? store || null : existing.store,
    amount: amount ?? existing.amount,
    description: description ?? existing.description,
  };
  db.prepare(`UPDATE expenses SET date = ?, category = ?, store = ?, amount = ?, description = ? WHERE id = ?`).run(
    next.date,
    next.category,
    next.store,
    next.amount,
    next.description,
    id
  );
  return db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id);
}

export function deleteExpense(id) {
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
}

/**
 * 月次収支サマリー(1年分)。売上は既存の「利用売上」(effectiveRevenue、
 * aggregations.jsのbuildAnnualTrend等と同じ基準)、経費はexpensesテーブルの
 * 合計。開業費・設備費(ASTERIA関連の一時費用)は営業利益の計算から除いた
 * 値・含めた値の両方を返す — ダッシュボード側で切り替えて表示する。
 */
export function getMonthlyPnL(year) {
  const revenueRows = db
    .prepare(`SELECT date, status, revenue FROM transactions WHERE substr(date, 1, 4) = ?`)
    .all(String(year));
  const expenseRows = db.prepare(`SELECT date, category, amount FROM expenses WHERE substr(date, 1, 4) = ?`).all(String(year));

  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    revenue: 0,
    expense: 0,
    expenseExcludingInitialCost: 0,
    initialCost: 0,
  }));

  for (const r of revenueRows) {
    const m = Number(r.date.slice(5, 7)) - 1;
    months[m].revenue += effectiveRevenue(r);
  }
  for (const e of expenseRows) {
    const m = Number(e.date.slice(5, 7)) - 1;
    months[m].expense += e.amount;
    if (e.category === INITIAL_COST_CATEGORY) {
      months[m].initialCost += e.amount;
    } else {
      months[m].expenseExcludingInitialCost += e.amount;
    }
  }

  return months.map((m) => ({
    ...m,
    profit: m.revenue - m.expense,
    profitExcludingInitialCost: m.revenue - m.expenseExcludingInitialCost,
  }));
}

/** 勘定科目ごとの合計(1年分、店舗別内訳つき)。 */
export function getCategoryBreakdown(year) {
  const rows = db.prepare(`SELECT category, store, amount FROM expenses WHERE substr(date, 1, 4) = ?`).all(String(year));
  const byCategory = new Map();
  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, { category: r.category, total: 0, byStore: {} });
    const entry = byCategory.get(r.category);
    entry.total += r.amount;
    const storeKey = r.store || "全社";
    entry.byStore[storeKey] = (entry.byStore[storeKey] || 0) + r.amount;
  }
  return EXPENSE_CATEGORIES.map((c) => byCategory.get(c)).filter(Boolean);
}
