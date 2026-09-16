import db from "./db.js";
import { getTodayISO } from "./config.js";
import { buildDashboard, buildAnnualTrend } from "./aggregations.js";

export function getAvailableYears() {
  const rows = db.prepare(`SELECT DISTINCT substr(date, 1, 4) AS y FROM transactions ORDER BY y DESC`).all();
  return rows.map((r) => Number(r.y));
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

function getAllRows() {
  return db.prepare(`SELECT date, store, revenue, status FROM transactions`).all();
}

export function getDashboard(requestedYear) {
  const years = getAvailableYears();
  if (years.length === 0) {
    return { years: [], year: null, message: "データがありません。CSVをインポートしてください。" };
  }

  const year = requestedYear && years.includes(requestedYear) ? requestedYear : years[0];
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
    todayISO: getTodayISO(),
  });

  const annualTrend = buildAnnualTrend(getAllRows(), storeNames);

  return { ...dashboard, years, storeMeta, annualTrend, todayISO: getTodayISO() };
}
