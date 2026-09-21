import db from "./db.js";
import { getTodayISO } from "./config.js";
import { buildDashboard, buildAnnualTrend, buildYoyByStore, buildRevenueSection } from "./aggregations.js";
import { listBusinessEventsInRange } from "./businessEventsService.js";

export function getAvailableYears() {
  const rows = db.prepare(`SELECT DISTINCT substr(date, 1, 4) AS y FROM transactions ORDER BY y DESC`).all();
  return rows.map((r) => Number(r.y));
}

// 年度未指定時のデフォルトは「現在の年」(データがあれば)。単純にyears[0]
// (データがある最新の年)にすると、6ヶ月先まで自動取り込みするようになった
// 影響で年末近くに翌年の利用前(PENDING)予約が入っただけで、翌年がデフォルト
// になってしまう。
function resolveYear(requestedYear, years) {
  if (requestedYear && years.includes(requestedYear)) return requestedYear;
  const todayYear = Number(getTodayISO().slice(0, 4));
  if (years.includes(todayYear)) return todayYear;
  return years[0];
}

function getStoreSettings() {
  return db.prepare(`SELECT * FROM store_settings ORDER BY sort_order, store`).all();
}

function getStoreOpenDates() {
  const rows = db.prepare(`SELECT store, MIN(date) AS open_date FROM transactions GROUP BY store`).all();
  return Object.fromEntries(rows.map((r) => [r.store, r.open_date]));
}

function getRowsForYear(year) {
  return db.prepare(`SELECT * FROM transactions WHERE substr(date, 1, 4) = ? ORDER BY date`).all(String(year));
}

export function getYoyByStore(year, month, store) {
  const storeSettingsRows = getStoreSettings();
  const storeNames = store ? [store] : storeSettingsRows.map((s) => s.store);
  const priorYear = year - 1;
  const years = getAvailableYears();
  const hasPriorYear = years.includes(priorYear);

  const filterStore = (rows) => (store ? rows.filter((r) => r.store === store) : rows);
  const yearRows = filterStore(getRowsForYear(year));
  const priorYearRows = hasPriorYear ? filterStore(getRowsForYear(priorYear)) : [];

  return buildYoyByStore({ storeNames, yearRows, priorYearRows, hasPriorYear, month });
}

/**
 * 売上分析ページの店舗フィルタ用。getDashboardと同じ売上系の集計
 * (monthlyTrend/yoyMonthly/yoyMonthlyCount/yoyBookingRevenue/yoyHours/
 * yoyByStore)だけを、任意でstoreに絞り込んで返す。
 */
export function getRevenueSection(requestedYear, store) {
  const years = getAvailableYears();
  if (years.length === 0) return { year: null };

  const year = resolveYear(requestedYear, years);
  const priorYear = year - 1;
  const hasPriorYear = years.includes(priorYear);
  const priorYear2 = year - 2;
  const hasPriorYear2 = years.includes(priorYear2);

  const storeSettingsRows = getStoreSettings();
  const storeNames = store ? [store] : storeSettingsRows.map((s) => s.store);

  const filterStore = (rows) => (store ? rows.filter((r) => r.store === store) : rows);
  const yearRows = filterStore(getRowsForYear(year));
  const priorYearRows = hasPriorYear ? filterStore(getRowsForYear(priorYear)) : [];
  const priorYear2Rows = hasPriorYear2 ? filterStore(getRowsForYear(priorYear2)) : [];
  const allRows = filterStore(getAllRows());

  const { monthlyTrend, yoyMonthly, yoyMonthlyCount, yoyBookingRevenue, yoyHours } = buildRevenueSection({
    year,
    priorYear,
    hasPriorYear,
    priorYear2,
    hasPriorYear2,
    yearRows,
    priorYearRows,
    priorYear2Rows,
    allRows,
  });

  const todayISO = getTodayISO();
  const todayYear = Number(todayISO.slice(0, 4));
  const todayMonth = Number(todayISO.slice(5, 7));
  const currentMonthTarget = year === todayYear ? todayMonth : null;
  const yoyByStore = buildYoyByStore({ storeNames, yearRows, priorYearRows, hasPriorYear, month: currentMonthTarget });

  return { year, priorYear, hasPriorYear, priorYear2, hasPriorYear2, monthlyTrend, yoyMonthly, yoyMonthlyCount, yoyBookingRevenue, yoyHours, yoyByStore };
}

function getAllRows() {
  return db
    .prepare(
      `SELECT date, store, revenue, hours_used, status, channel, booking_date, revenue_confirmed_date, booking_amount FROM transactions`
    )
    .all();
}

export function getDashboard(requestedYear) {
  const years = getAvailableYears();
  if (years.length === 0) {
    return { years: [], year: null, message: "データがありません。CSVをインポートしてください。" };
  }

  const year = resolveYear(requestedYear, years);
  const priorYear = year - 1;
  const hasPriorYear = years.includes(priorYear);
  const priorYear2 = year - 2;
  const hasPriorYear2 = years.includes(priorYear2);

  const storeSettingsRows = getStoreSettings();
  const inferredOpenDates = getStoreOpenDates();

  const storeNames = storeSettingsRows.map((s) => s.store);
  const storeMeta = Object.fromEntries(
    storeSettingsRows.map((s) => [
      s.store,
      {
        openDate: s.open_date || inferredOpenDates[s.store] || null,
        hoursPerDay: s.operating_hours_per_day,
        color: s.color,
        area: s.area,
      },
    ])
  );

  const yearRows = getRowsForYear(year);
  const priorYearRows = hasPriorYear ? getRowsForYear(priorYear) : [];
  const priorYear2Rows = hasPriorYear2 ? getRowsForYear(priorYear2) : [];
  const allRows = getAllRows();
  const events = listBusinessEventsInRange(`${year}-01-01`, `${year}-12-31`);

  const dashboard = buildDashboard({
    year,
    priorYear,
    hasPriorYear,
    priorYear2,
    hasPriorYear2,
    storeNames,
    storeMeta,
    yearRows,
    priorYearRows,
    priorYear2Rows,
    allRows,
    todayISO: getTodayISO(),
    events,
  });

  const annualTrend = buildAnnualTrend(allRows, storeNames);

  return { ...dashboard, years, storeMeta, annualTrend, todayISO: getTodayISO() };
}
