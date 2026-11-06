// 店舗 × 曜日 × 時間帯の稼働率(空き状況のヒートマップ用)。直近 N か月の利用実績から、
// 各「曜日・時間帯」のマスが何%埋まっていたかを出す(空いている時間帯を狙った施策に使う)。
//
// 稼働率 = その曜日・時間帯に使われた分数 ÷ (期間中のその曜日の日数 × 60分)。
// 店舗の営業開始日より前の日は数えない。
import db from "./db.js";
import { getTodayISO, HOURS_USED_STATUSES, WEEKDAYS } from "./config.js";
import { countWeekdayOccurrences } from "./aggregations.js";

const shiftMonths = (iso, months) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
};
const shiftDays = (iso, days) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
// "2026-10-05" → 0=月 … 6=日
const weekdayIndex = (iso) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

const DEFAULT_FIRST_HOUR = 8;
const DEFAULT_LAST_HOUR = 22; // この時刻の枠(22時台)まで

/** @param {{ months?: number, openDates?: Record<string, string|null> }} opts */
export function getVacancyHeatmap({ months = 3, openDates = {} } = {}) {
  const to = shiftDays(getTodayISO(), -1); // 昨日まで(実績が確定している分)
  const from = shiftDays(shiftMonths(to, months), 1);
  const statuses = [...HOURS_USED_STATUSES];
  const rows = db
    .prepare(
      `SELECT date, store, start_hour, start_minute, hours_used FROM transactions
       WHERE date >= ? AND date <= ? AND start_hour IS NOT NULL AND hours_used > 0
         AND status IN (${statuses.map(() => "?").join(",")})`
    )
    .all(from, to, ...statuses);
  const stores = db.prepare(`SELECT store FROM store_settings ORDER BY sort_order, store`).all().map((s) => s.store);

  // 使われた分数を 店舗 → 曜日 → 時(0〜23) に振り分ける。
  const minutes = Object.fromEntries(stores.map((s) => [s, WEEKDAYS.map(() => new Array(24).fill(0))]));
  let firstHour = 24;
  let lastHour = -1;
  for (const r of rows) {
    if (!minutes[r.store]) continue;
    const wd = weekdayIndex(r.date);
    let t = r.start_hour * 60 + (r.start_minute ?? 0);
    const end = Math.min(t + Math.round(r.hours_used * 60), 24 * 60);
    firstHour = Math.min(firstHour, Math.floor(t / 60));
    lastHour = Math.max(lastHour, Math.ceil(end / 60) - 1);
    while (t < end) {
      const hourEnd = (Math.floor(t / 60) + 1) * 60;
      const until = Math.min(end, hourEnd);
      minutes[r.store][wd][Math.floor(t / 60)] += until - t;
      t = until;
    }
  }
  if (lastHour < 0) {
    firstHour = DEFAULT_FIRST_HOUR;
    lastHour = DEFAULT_LAST_HOUR;
  }
  firstHour = Math.min(firstHour, DEFAULT_FIRST_HOUR);
  lastHour = Math.max(lastHour, DEFAULT_LAST_HOUR - 1);
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);

  const pct = (used, days) => (days > 0 ? Math.round((used / (days * 60)) * 1000) / 10 : null);
  const storeGrids = stores.map((store) => {
    const start = openDates[store] && openDates[store] > from ? openDates[store] : from;
    const days = WEEKDAYS.map((_, wd) => (start > to ? 0 : countWeekdayOccurrences(wd, start, to)));
    return {
      store,
      days,
      grid: WEEKDAYS.map((_, wd) => hours.map((h) => pct(minutes[store][wd][h], days[wd]))),
    };
  });

  // 全店舗合計(営業していた店舗の枠の合計に対する割合)。
  const total = {
    store: "全店舗",
    days: WEEKDAYS.map((_, wd) => storeGrids.reduce((s, g) => s + g.days[wd], 0)),
    grid: WEEKDAYS.map((_, wd) =>
      hours.map((h) =>
        pct(
          stores.reduce((s, st) => s + minutes[st][wd][h], 0),
          storeGrids.reduce((s, g) => s + g.days[wd], 0)
        )
      )
    ),
  };

  return { from, to, months, weekdays: WEEKDAYS, hours, stores: [total, ...storeGrids] };
}
