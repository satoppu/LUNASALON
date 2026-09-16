// Pure aggregation logic, ported 1:1 from the chat prototype's React
// useMemo blocks (see spec section 5) but reworked to enforce the business
// rules (spec 4.2/4.3) against a `status` column instead of trusting
// pre-baked revenue/hours figures — so a future CSV that includes raw
// statuses (e.g. straight from the reservation system) aggregates correctly
// without any UI changes.
import { REVENUE_STATUSES, HOURS_USED_STATUSES, CHANNELS, WEEKDAYS, MONTH_LABELS, SUBSCRIPTION_STATUS } from "./config.js";

export function daysBetweenInclusive(startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (end < start) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

// weekdayIndex: 0=月...6=日, matching WEEKDAYS.
export function countWeekdayOccurrences(weekdayIndex, startISO, endISO) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (end < start) return 0;
  let count = 0;
  const jsTargetDow = (weekdayIndex + 1) % 7; // 月=0..日=6 -> JS getDay() 日=0..土=6
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() === jsTargetDow) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export const effectiveRevenue = (row) => (REVENUE_STATUSES.has(row.status) ? row.revenue : 0);
export const effectiveHours = (row) => (HOURS_USED_STATUSES.has(row.status) ? row.hours_used : 0);

function availableHoursForStore(store, yearStartISO, yearEndISO, storeMeta, todayISO) {
  const meta = storeMeta[store];
  const open = meta?.openDate || yearStartISO;
  const start = open > yearStartISO ? open : yearStartISO;
  const cap = todayISO < yearEndISO ? todayISO : yearEndISO;
  const days = daysBetweenInclusive(start, cap);
  return Math.max(0, days) * (meta?.hoursPerDay ?? 14);
}

function availableHoursForStoreWeekday(store, weekdayIndex, yearStartISO, yearEndISO, storeMeta, todayISO) {
  const meta = storeMeta[store];
  const open = meta?.openDate || yearStartISO;
  const start = open > yearStartISO ? open : yearStartISO;
  const cap = todayISO < yearEndISO ? todayISO : yearEndISO;
  const occurrences = countWeekdayOccurrences(weekdayIndex, start, cap);
  return occurrences * (meta?.hoursPerDay ?? 14);
}

export function yen(n) {
  return Math.round(n);
}

/**
 * @param {object} params
 * @param {number} params.year
 * @param {number} params.priorYear
 * @param {boolean} params.hasPriorYear
 * @param {number} params.priorYear2
 * @param {boolean} params.hasPriorYear2
 * @param {string[]} params.storeNames - ordered store names
 * @param {Record<string, {openDate: string, hoursPerDay: number, color: string, area: string}>} params.storeMeta
 * @param {object[]} params.yearRows
 * @param {object[]} params.priorYearRows
 * @param {object[]} params.priorYear2Rows
 * @param {string} params.todayISO
 */
export function buildDashboard({
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
  todayISO,
}) {
  const yearStartISO = `${year}-01-01`;
  const yearEndISO = `${year}-12-31`;

  // ---- Per-store summary ----
  const summary = {};
  storeNames.forEach((name) => {
    summary[name] = { revenue: 0, hoursUsed: 0, count: 0 };
  });
  yearRows.forEach((r) => {
    if (!summary[r.store]) summary[r.store] = { revenue: 0, hoursUsed: 0, count: 0 };
    summary[r.store].revenue += effectiveRevenue(r);
    summary[r.store].hoursUsed += effectiveHours(r);
    if (effectiveHours(r) > 0) summary[r.store].count += 1;
  });

  // ---- Monthly revenue trend ----
  const monthlyTrend = MONTH_LABELS.map((label) => ({ label }));
  yearRows.forEach((r) => {
    const m = Number(r.date.slice(5, 7)) - 1;
    monthlyTrend[m][r.store] = (monthlyTrend[m][r.store] || 0) + effectiveRevenue(r);
  });

  // ---- Occupancy rate by store ----
  const occupancyData = storeNames.map((name) => {
    const s = summary[name];
    const availableHours = availableHoursForStore(name, yearStartISO, yearEndISO, storeMeta, todayISO);
    const rate = availableHours > 0 ? (s.hoursUsed / availableHours) * 100 : 0;
    return { store: name, 稼働率: Math.round(rate * 10) / 10 };
  });

  // ---- Hourly usage (time-of-day) ----
  const hourlyBuckets = {};
  for (let h = 0; h < 24; h++) hourlyBuckets[h] = { hour: `${h}時`, total: 0 };
  yearRows.forEach((r) => {
    const hrs = effectiveHours(r);
    if (r.start_hour == null || hrs <= 0) return;
    hourlyBuckets[r.start_hour].total += hrs;
    hourlyBuckets[r.start_hour][r.store] = (hourlyBuckets[r.start_hour][r.store] || 0) + hrs;
  });
  const hourlyArr = Object.values(hourlyBuckets);
  let startIdx = hourlyArr.findIndex((b) => b.total > 0);
  let endIdx = hourlyArr.length - 1 - [...hourlyArr].reverse().findIndex((b) => b.total > 0);
  const hourlyUsage = startIdx === -1 ? hourlyArr : hourlyArr.slice(startIdx, endIdx + 1);

  // ---- Weekday occupancy ----
  const weekdayOccupancy = WEEKDAYS.map((wd, idx) => {
    const entry = { weekday: wd };
    storeNames.forEach((name) => {
      const used = yearRows
        .filter((r) => r.store === name && r.weekday === wd)
        .reduce((sum, r) => sum + effectiveHours(r), 0);
      const available = availableHoursForStoreWeekday(name, idx, yearStartISO, yearEndISO, storeMeta, todayISO);
      entry[name] = available > 0 ? Math.round((used / available) * 1000) / 10 : 0;
    });
    return entry;
  });

  // ---- Channel (導線) analysis ----
  // 定期クーポン revenue is store-linked but isn't a booking channel (spec 4.6),
  // so it's counted in store/monthly/user revenue above but left out of this
  // breakdown entirely rather than bucketed into "その他".
  const channelRows = yearRows.filter((r) => r.status !== SUBSCRIPTION_STATUS);
  const channelMap = {};
  CHANNELS.forEach((c) => (channelMap[c] = { channel: c, revenue: 0, count: 0 }));
  channelRows.forEach((r) => {
    const c = CHANNELS.includes(r.channel) ? r.channel : "その他";
    if (!channelMap[c]) channelMap[c] = { channel: c, revenue: 0, count: 0 };
    channelMap[c].revenue += effectiveRevenue(r);
    if (effectiveHours(r) > 0) channelMap[c].count += 1;
  });
  const channelSummary = Object.values(channelMap).filter((c) => c.revenue > 0 || c.count > 0);

  const channelByStore = storeNames.map((name) => {
    const entry = { store: name };
    let total = 0;
    CHANNELS.forEach((c) => {
      const rev = channelRows
        .filter((r) => r.store === name && (CHANNELS.includes(r.channel) ? r.channel : "その他") === c)
        .reduce((sum, r) => sum + effectiveRevenue(r), 0);
      entry[c] = rev;
      total += rev;
    });
    entry.total = total;
    return entry;
  });

  // ---- Recent rows (most recent 12) ----
  const recentRows = [...yearRows].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

  // ---- Overall stats ----
  const usedRows = yearRows.filter((r) => effectiveHours(r) > 0);
  const totalHoursUsed = yearRows.reduce((sum, r) => sum + effectiveHours(r), 0);
  const totalAvailable = storeNames.reduce(
    (sum, name) => sum + availableHoursForStore(name, yearStartISO, yearEndISO, storeMeta, todayISO),
    0
  );
  const avgHoursPerUse = usedRows.length > 0 ? totalHoursUsed / usedRows.length : 0;
  const avgOccupancy = totalAvailable > 0 ? (totalHoursUsed / totalAvailable) * 100 : 0;
  const uniqueUsers = new Set(yearRows.map((r) => r.user_name)).size;
  const overallStats = { avgHoursPerUse, avgOccupancy, totalUses: usedRows.length, uniqueUsers };

  // ---- Top 10 users by revenue ----
  const userMap = {};
  yearRows.forEach((r) => {
    if (!userMap[r.user_name]) {
      userMap[r.user_name] = { user: r.user_name, storeCounts: {}, revenue: 0, hoursUsed: 0, count: 0 };
    }
    const u = userMap[r.user_name];
    u.revenue += effectiveRevenue(r);
    u.hoursUsed += effectiveHours(r);
    if (effectiveHours(r) > 0) u.count += 1;
    u.storeCounts[r.store] = (u.storeCounts[r.store] || 0) + 1;
  });
  const userSummary = Object.values(userMap)
    .map((u) => {
      const mainStore = Object.entries(u.storeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return { ...u, mainStore, avgHours: u.count > 0 ? u.hoursUsed / u.count : 0 };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ---- Year-over-year (up to 3 years: selected year + 2 prior years) ----
  const yoyYears = [
    { year, rows: yearRows, has: true },
    { year: priorYear, rows: priorYearRows, has: hasPriorYear },
    { year: priorYear2, rows: priorYear2Rows, has: hasPriorYear2 },
  ];
  const yoyMonthly = MONTH_LABELS.map((label, idx) => {
    const entry = { label };
    yoyYears.forEach(({ year: y, rows, has }) => {
      entry[`${y}年`] = has
        ? rows.filter((r) => Number(r.date.slice(5, 7)) - 1 === idx).reduce((sum, r) => sum + effectiveRevenue(r), 0)
        : undefined;
    });
    return entry;
  });

  // Compare the same month across stores. For the current calendar year, the
  // latest month is usually still in progress, so use the last *completed*
  // month instead — otherwise a handful of this-month bookings gets compared
  // against a full prior-year month. Past years use their actual last month
  // with data (a store that opened mid-year has no earlier months to show).
  const todayYear = Number(todayISO.slice(0, 4));
  const todayMonth = Number(todayISO.slice(5, 7));
  const currentMonthTarget = year === todayYear && todayMonth > 1 ? todayMonth - 1 : null;

  const yoyByStore = storeNames
    .map((name) => {
      const storeYearRows = yearRows.filter((r) => r.store === name);
      if (storeYearRows.length === 0) return null;
      const monthsWithData = Array.from(new Set(storeYearRows.map((r) => Number(r.date.slice(5, 7)))));
      const latestMonth = currentMonthTarget ?? Math.max(...monthsWithData);
      const curRevenue = storeYearRows
        .filter((r) => Number(r.date.slice(5, 7)) === latestMonth)
        .reduce((sum, r) => sum + effectiveRevenue(r), 0);
      const prevRevenueRows = priorYearRows.filter(
        (r) => r.store === name && Number(r.date.slice(5, 7)) === latestMonth
      );
      const hasPrev = hasPriorYear && prevRevenueRows.length > 0;
      const prevRevenue = hasPrev ? prevRevenueRows.reduce((sum, r) => sum + effectiveRevenue(r), 0) : null;
      const pct = hasPrev && prevRevenue > 0 ? ((curRevenue - prevRevenue) / prevRevenue) * 100 : null;
      return { store: name, latestMonth, curRevenue, prevRevenue, pct, hasPrev };
    })
    .filter(Boolean);

  return {
    year,
    priorYear,
    hasPriorYear,
    priorYear2,
    hasPriorYear2,
    storeNames,
    summary,
    monthlyTrend,
    occupancyData,
    hourlyUsage,
    weekdayOccupancy,
    channelSummary,
    channelByStore,
    recentRows,
    overallStats,
    userSummary,
    yoyMonthly,
    yoyByStore,
  };
}

/** Total revenue per store per year, across all years in the data (independent of the selected year). */
export function buildAnnualTrend(allRows, storeNames) {
  const byYear = {};
  allRows.forEach((r) => {
    const y = Number(r.date.slice(0, 4));
    if (!byYear[y]) {
      byYear[y] = { year: y };
      storeNames.forEach((name) => { byYear[y][name] = 0; });
    }
    if (!(r.store in byYear[y])) byYear[y][r.store] = 0;
    byYear[y][r.store] += effectiveRevenue(r);
  });
  return Object.values(byYear).sort((a, b) => a.year - b.year);
}
