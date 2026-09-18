// Pure aggregation logic, ported 1:1 from the chat prototype's React
// useMemo blocks (see spec section 5) but reworked to enforce the business
// rules (spec 4.2/4.3) against a `status` column instead of trusting
// pre-baked revenue/hours figures — so a future CSV that includes raw
// statuses (e.g. straight from the reservation system) aggregates correctly
// without any UI changes.
import { REVENUE_STATUSES, HOURS_USED_STATUSES, CHANNELS, WEEKDAYS, MONTH_LABELS, SUBSCRIPTION_STATUS, PENDING_STATUS } from "./config.js";

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

const isCancellationStatus = (status) => typeof status === "string" && status.startsWith("キャンセル");

// Which month a row's revenue counts against on a 決済日ベース (booking-date)
// chart. Normally that's booking_date (when the money changed hands). For a
// cancelled row, though, revenue_confirmed_date (自社サイトの「売り上げ確定
// 日時」) is when the cancellation was actually processed — often a later
// month than the original booking — so the cancellation's impact books
// against that month instead of retroactively inside the booking month. Only
// populated for 自社サイト rows today; anything else falls back to the
// existing booking_date/date behavior unchanged.
function bookingBucketMonth(row) {
  if (isCancellationStatus(row.status) && row.revenue_confirmed_date) {
    return row.revenue_confirmed_date.slice(0, 7);
  }
  return (row.booking_date || row.date).slice(0, 7);
}

// 決済日ベース revenue, split into up to two dated contributions per row:
// the full amount charged at booking time (決済元金+割引金額, "予約時の
// 売上") always lands in booking_date's month, and — only for a cancelled
// 自社サイト row whose cancellation was processed in a *different* month —
// a second, negative contribution equal to what was lost (booking_amount
// minus the row's current settled revenue) lands in revenue_confirmed_date's
// month instead of being netted invisibly into the booking month. For a
// completed booking booking_amount equals revenue, so this is a no-op there;
// rows without booking_amount (other channels, not-yet-backfilled data) fall
// back to the single-contribution booking_date/date behavior unchanged.
function bookingRevenueContributions(row) {
  if (row.channel === OWN_SITE_CHANNEL && row.booking_amount != null) {
    const bookingMonth = (row.booking_date || row.date).slice(0, 7);
    let bookingMonthAmount = row.booking_amount;
    const contributions = [];
    if (isCancellationStatus(row.status)) {
      const lost = row.booking_amount - effectiveRevenue(row);
      if (lost !== 0) {
        const confirmMonth = row.revenue_confirmed_date ? row.revenue_confirmed_date.slice(0, 7) : bookingMonth;
        if (confirmMonth !== bookingMonth) {
          // Cancellation processed in a later (or earlier) month than the
          // booking: keep the full booking-time amount in the booking month
          // and book the loss as its own negative entry in the month the
          // cancellation actually happened.
          contributions.push({ month: confirmMonth, amount: -lost });
        } else {
          // Cancellation processed the same month it was booked: nothing to
          // split across months, so net the loss directly into that month's
          // single entry (equal to effectiveRevenue(row)).
          bookingMonthAmount -= lost;
        }
      }
    }
    contributions.unshift({ month: bookingMonth, amount: bookingMonthAmount });
    return contributions;
  }
  return [{ month: bookingBucketMonth(row), amount: effectiveRevenue(row) }];
}

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

  // ---- Monthly revenue trend (通常予約 vs 定期クーポン, all stores combined) ----
  // 決済日ベース is the same rows' revenue grouped by when payment actually
  // happened (booking_date — 自社サイト's 決済日時(データ入力用), Instabase's
  // 申込日時, or the row's own date for 定期クーポン / anything not yet
  // backfilled) rather than by usage date, so the two bases can be compared
  // on one chart. A booking paid in one year for usage early the next still
  // lands in this year-scoped array under its payment month (spec: this is a
  // same-page visual comparison, not a strict per-year accounting split). For
  // 自社サイト rows, this is now the double-entry split from
  // bookingRevenueContributions: the full amount stays in the booking month
  // even after a later cancellation, and the cancellation itself shows up as
  // a separate negative dip in whatever month it was actually processed.
  const monthlyTrend = MONTH_LABELS.map((label) => ({ label, 通常予約: 0, 定期クーポン: 0, 決済日ベース: 0 }));
  yearRows.forEach((r) => {
    const m = Number(r.date.slice(5, 7)) - 1;
    const key = r.status === SUBSCRIPTION_STATUS ? "定期クーポン" : "通常予約";
    monthlyTrend[m][key] += effectiveRevenue(r);
    bookingRevenueContributions(r).forEach(({ month, amount }) => {
      const bm = Number(month.slice(5, 7)) - 1;
      monthlyTrend[bm].決済日ベース += amount;
    });
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

  // Same 3-year comparison, but counting actual visits (spec 4.3) instead of revenue.
  const yoyMonthlyCount = MONTH_LABELS.map((label, idx) => {
    const entry = { label };
    yoyYears.forEach(({ year: y, rows, has }) => {
      entry[`${y}年`] = has
        ? rows.filter((r) => Number(r.date.slice(5, 7)) - 1 === idx && effectiveHours(r) > 0).length
        : undefined;
    });
    return entry;
  });

  // Compare the same month across stores. For the current calendar year, use
  // the current (possibly in-progress) month. Past years use their actual
  // last month with data (a store that opened mid-year has no earlier
  // months to show).
  const todayYear = Number(todayISO.slice(0, 4));
  const todayMonth = Number(todayISO.slice(5, 7));
  const currentMonthTarget = year === todayYear ? todayMonth : null;

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
    yoyMonthlyCount,
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

/**
 * Monthly revenue for the last 36 months (3 years) ending at the latest
 * booking-date-having data, grouped by booking_date (自社サイト's 決済日時
 * (データ入力用), Instabase's 申込日時, or the row's own date as a fallback
 * for anything not yet backfilled/dated that way — 定期クーポン's date is
 * already its purchase date, so it needs no fallback distinction). For
 * 自社サイト rows with a captured booking_amount, each row contributes via
 * bookingRevenueContributions: the full booking-time amount in the booking
 * month, plus (for a cancellation processed in a later month) a separate
 * negative entry in the month the cancellation actually happened, instead of
 * netting it invisibly back into the booking month. Independent of the
 * selected year, like buildAnnualTrend.
 */
export function buildBookingDateMonthlyTrend(allRows) {
  const byYM = new Map();
  allRows.forEach((r) => {
    bookingRevenueContributions(r).forEach(({ month, amount }) => {
      byYM.set(month, (byYM.get(month) || 0) + amount);
    });
  });
  const yms = [...byYM.keys()].sort();
  if (yms.length === 0) return [];
  const maxYM = yms[yms.length - 1];
  const minYM = shiftYearMonth(maxYM, -35);
  return enumerateYearMonths(minYM, maxYM).map((ym) => ({
    yearMonth: ym,
    label: formatYearMonth(ym),
    revenue: byYM.get(ym) || 0,
  }));
}

// ---- Customer analysis (spans all years, independent of the selected year) ----

function shiftYearMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function enumerateYearMonths(startYM, endYM) {
  const months = [];
  for (let ym = startYM; ym <= endYM; ym = shiftYearMonth(ym, 1)) months.push(ym);
  return months;
}

function formatYearMonth(ym) {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
}

/**
 * Per-customer profile: first actual-visit date, lifetime visit count/revenue,
 * and a per-year breakdown of visit count and revenue. Customers who only
 * ever appear as a cancellation (no actual visit) are excluded — they never
 * used the service. Revenue follows the same effectiveRevenue rule as
 * everywhere else (includes cancellation fees and subscription revenue);
 * visit count only counts rows that were actually used (spec 4.3).
 */
export function buildCustomerProfiles(allRows) {
  const byUser = new Map();
  allRows.forEach((r) => {
    if (!byUser.has(r.user_name)) byUser.set(r.user_name, []);
    byUser.get(r.user_name).push(r);
  });

  const customers = [];
  for (const [user, rows] of byUser) {
    const visits = rows.filter((r) => effectiveHours(r) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (visits.length === 0) continue;

    const byYear = {};
    rows.forEach((r) => {
      const y = Number(r.date.slice(0, 4));
      if (!byYear[y]) {
        byYear[y] = { year: y, count: 0, cancelCount: 0, revenue: 0, subscriptionCount: 0, subscriptionRevenue: 0 };
      }
      const entry = byYear[y];
      entry.revenue += effectiveRevenue(r);
      if (r.status === SUBSCRIPTION_STATUS) {
        entry.subscriptionCount += 1;
        entry.subscriptionRevenue += effectiveRevenue(r);
      } else if (effectiveHours(r) > 0) {
        entry.count += 1;
      } else if (r.status !== PENDING_STATUS) {
        entry.cancelCount += 1;
      }
    });
    const byYearList = Object.values(byYear).sort((a, b) => b.year - a.year);

    const storeCounts = {};
    rows.forEach((r) => {
      storeCounts[r.store] = (storeCounts[r.store] || 0) + 1;
    });
    const primaryStore = Object.entries(storeCounts).sort((a, b) => b[1] - a[1])[0][0];

    customers.push({
      user,
      primaryStore,
      firstUseDate: visits[0].date,
      lastUseDate: visits[visits.length - 1].date,
      totalCount: visits.length,
      totalCancelCount: byYearList.reduce((sum, y) => sum + y.cancelCount, 0),
      totalRevenue: rows.reduce((sum, r) => sum + effectiveRevenue(r), 0),
      totalSubscriptionCount: byYearList.reduce((sum, y) => sum + y.subscriptionCount, 0),
      totalSubscriptionRevenue: byYearList.reduce((sum, y) => sum + y.subscriptionRevenue, 0),
      byYear: byYearList,
    });
  }

  return customers.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/** New-customer count per calendar month, based on each customer's first actual visit. */
export function buildNewCustomersByMonth(customerProfiles) {
  const counts = {};
  customerProfiles.forEach((c) => {
    const ym = c.firstUseDate.slice(0, 7);
    counts[ym] = (counts[ym] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .map((ym) => ({ yearMonth: ym, label: formatYearMonth(ym), count: counts[ym] }));
}

/**
 * Active-customer count per calendar month: a customer is active in month M
 * if their lifetime visit count through M is >= 5 AND they have at least one
 * visit in the trailing 3-month window ending at M (M-2..M inclusive).
 */
export function buildActiveCustomersByMonth(allRows) {
  const visitYearMonthsByUser = new Map();
  allRows.forEach((r) => {
    if (effectiveHours(r) <= 0) return;
    if (!visitYearMonthsByUser.has(r.user_name)) visitYearMonthsByUser.set(r.user_name, []);
    visitYearMonthsByUser.get(r.user_name).push(r.date.slice(0, 7));
  });
  for (const months of visitYearMonthsByUser.values()) months.sort();

  const allYearMonths = [...visitYearMonthsByUser.values()].flat();
  if (allYearMonths.length === 0) return [];
  const minYM = allYearMonths.reduce((a, b) => (a < b ? a : b));
  const maxYM = allYearMonths.reduce((a, b) => (a > b ? a : b));

  return enumerateYearMonths(minYM, maxYM).map((ym) => {
    const windowStart = shiftYearMonth(ym, -2);
    const users = [];
    for (const [user, months] of visitYearMonthsByUser) {
      const cumulativeCount = months.filter((m) => m <= ym).length;
      if (cumulativeCount < 5) continue;
      if (months.some((m) => m >= windowStart && m <= ym)) users.push(user);
    }
    users.sort();
    return { yearMonth: ym, label: formatYearMonth(ym), count: users.length, users };
  });
}

// ---- Booking lead time (spans all years, independent of the selected year) ----

const LEAD_TIME_BUCKETS = [
  { label: "当日", min: 0, max: 0 },
  { label: "1日前", min: 1, max: 1 },
  { label: "2〜3日前", min: 2, max: 3 },
  { label: "4〜7日前", min: 4, max: 7 },
  { label: "8〜14日前", min: 8, max: 14 },
  { label: "15〜30日前", min: 15, max: 30 },
  { label: "31日以上前", min: 31, max: Infinity },
];

// 決済日時（データ入力用）is only present in the 自社サイト raw booking export
// (see rawImportMappers.js mapRawBookingRow) and is what booking_date is
// built from for those rows. Instabase's booking_date instead comes from
// 申込日時, a different source field, so it's excluded here to keep this
// chart strictly grounded in 決済日時（データ入力用）.
const OWN_SITE_CHANNEL = "自社サイト";

/**
 * Distribution of "days between booking and usage" for 自社サイト
 * reservations, based on 決済日時（データ入力用）(`booking_date` — see
 * rawImportMappers.js). Rows from the historical seed CSV or a
 * simple-template import have no booking_date and are silently excluded
 * here, not treated as same-day bookings. Counts every row with a
 * booking_date regardless of status (spec: this is about booking behavior,
 * not just completed visits), discarding the rare negative-gap row as bad
 * data.
 */
export function buildBookingLeadTime(allRows) {
  const buckets = LEAD_TIME_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  let total = 0;
  allRows.forEach((r) => {
    if (r.channel !== OWN_SITE_CHANNEL || !r.booking_date) return;
    const days = Math.round((new Date(r.date) - new Date(r.booking_date)) / 86400000);
    if (days < 0) return;
    const idx = LEAD_TIME_BUCKETS.findIndex((b) => days >= b.min && days <= b.max);
    if (idx === -1) return;
    buckets[idx].count += 1;
    total += 1;
  });
  return { buckets, total };
}

const LEAD_MONTH_BUCKET_LABELS = ["同月予約", "1ヶ月前予約", "2ヶ月前予約", "3ヶ月以上前予約"];

function monthDiff(fromYM, toYM) {
  const [fy, fm] = fromYM.split("-").map(Number);
  const [ty, tm] = toYM.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/**
 * For each usage month over the last 36 months, splits that month's 自社サイト
 * activity by how far ahead it was booked (同月/1ヶ月前/2ヶ月前/3ヶ月以上前),
 * based on 決済日時（データ入力用）(booking_date) — same scope as
 * buildBookingLeadTime. valueFn picks what's summed per row (revenue or
 * hours). Answers "how much of this month's usage was booked how far in
 * advance", e.g. to see a June booking rush feeding July/August usage, and
 * to compare that seasonal pattern year over year.
 */
function buildBookingToUsageMonthlyBy(allRows, valueFn) {
  const byUsageMonth = new Map();
  allRows.forEach((r) => {
    if (r.channel !== OWN_SITE_CHANNEL || !r.booking_date) return;
    const usageYM = r.date.slice(0, 7);
    const bookingYM = r.booking_date.slice(0, 7);
    const diff = monthDiff(bookingYM, usageYM);
    if (diff < 0) return;
    const bucket = LEAD_MONTH_BUCKET_LABELS[Math.min(diff, 3)];
    if (!byUsageMonth.has(usageYM)) {
      const entry = { yearMonth: usageYM };
      LEAD_MONTH_BUCKET_LABELS.forEach((label) => { entry[label] = 0; });
      byUsageMonth.set(usageYM, entry);
    }
    byUsageMonth.get(usageYM)[bucket] += valueFn(r);
  });

  const yms = [...byUsageMonth.keys()].sort();
  if (yms.length === 0) return [];
  const maxYM = yms[yms.length - 1];
  const minYM = shiftYearMonth(maxYM, -35);
  return enumerateYearMonths(minYM, maxYM).map((ym) => {
    const entry = byUsageMonth.get(ym);
    const row = { yearMonth: ym, label: formatYearMonth(ym) };
    LEAD_MONTH_BUCKET_LABELS.forEach((label) => { row[label] = entry?.[label] || 0; });
    return row;
  });
}

export function buildBookingToUsageMonthly(allRows) {
  return buildBookingToUsageMonthlyBy(allRows, effectiveRevenue);
}

/**
 * Same breakdown as buildBookingToUsageMonthly, but by 利用時間(hours used)
 * instead of revenue — 定期クーポン's flat pre-paid fee means revenue alone
 * understates how busy a month with heavy subscription use actually was, so
 * hours is the more reliable read on real room demand.
 */
export function buildBookingToUsageMonthlyHours(allRows) {
  return buildBookingToUsageMonthlyBy(allRows, effectiveHours);
}

/**
 * Total 利用時間(hours used) per usage month for the last 36 months, across
 * all channels — the hours-based counterpart to buildBookingDateMonthlyTrend,
 * for reading actual room demand independent of how revenue was booked
 * (subscription vs per-visit).
 */
export function buildHoursMonthlyTrend(allRows) {
  const byYM = new Map();
  allRows.forEach((r) => {
    const ym = r.date.slice(0, 7);
    byYM.set(ym, (byYM.get(ym) || 0) + effectiveHours(r));
  });
  const yms = [...byYM.keys()].sort();
  if (yms.length === 0) return [];
  const maxYM = yms[yms.length - 1];
  const minYM = shiftYearMonth(maxYM, -35);
  return enumerateYearMonths(minYM, maxYM).map((ym) => ({
    yearMonth: ym,
    label: formatYearMonth(ym),
    hours: Math.round((byYM.get(ym) || 0) * 10) / 10,
  }));
}
