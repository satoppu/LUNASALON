// スペースマーケットは予約数が少ないため、CSV取り込みの代わりに手動で
// 実績を登録する画面(設定→記録)向け。channelは常に「スペースマーケット」
// 固定、manual_entry=1を立てて、インポート済みの行と混ざらないようにする。
import db from "./db.js";
import { WEEKDAY_FROM_JS_DOW, PENDING_STATUS } from "./config.js";

const SPACEMARKET_CHANNEL = "スペースマーケット";

export const MANUAL_ENTRY_STATUSES = [
  "利用済み",
  PENDING_STATUS,
  "キャンセル(顧客)",
  "キャンセル(返金あり)",
  "キャンセル(オーナー)",
];

const HOURS_USED_ELIGIBLE = new Set(["利用済み", PENDING_STATUS]);

function toMinutes(hhmm) {
  if (!hhmm) return null;
  const m = String(hhmm).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function computeFields({ date, status, startTime, endTime }) {
  const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  const startHour = startMin != null ? Math.floor(startMin / 60) : null;
  const startMinute = startMin != null ? startMin % 60 : null;
  let hoursUsed = 0;
  if (HOURS_USED_ELIGIBLE.has(status) && startMin != null && endMin != null) {
    let diffMin = endMin - startMin;
    if (diffMin <= 0) diffMin += 24 * 60;
    hoursUsed = diffMin / 60;
  }
  return { weekday, startHour, startMinute, hoursUsed };
}

export function listManualSpaceMarketTransactions() {
  return db
    .prepare(`SELECT * FROM transactions WHERE manual_entry = 1 ORDER BY date DESC, id DESC`)
    .all();
}

export function createManualSpaceMarketTransaction({ date, store, userName, status, revenue, startTime, endTime, bookingDate }) {
  const { weekday, startHour, startMinute, hoursUsed } = computeFields({ date, status, startTime, endTime });
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, start_minute, weekday, channel, status, external_id, booking_date, manual_entry)
       VALUES (@date, @store, @userName, @revenue, @hoursUsed, @startHour, @startMinute, @weekday, @channel, @status, NULL, @bookingDate, 1)`
    )
    .run({
      date,
      store,
      userName,
      revenue,
      hoursUsed,
      startHour,
      startMinute,
      weekday,
      channel: SPACEMARKET_CHANNEL,
      status,
      bookingDate: bookingDate || null,
    });
  return db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(lastInsertRowid);
}

export function updateManualSpaceMarketTransaction(id, { date, store, userName, status, revenue, startTime, endTime, bookingDate }) {
  const existing = db.prepare(`SELECT * FROM transactions WHERE id = ? AND manual_entry = 1`).get(id);
  if (!existing) return null;
  const { weekday, startHour, startMinute, hoursUsed } = computeFields({ date, status, startTime, endTime });
  db.prepare(
    `UPDATE transactions
     SET date = @date, store = @store, user_name = @userName, revenue = @revenue, hours_used = @hoursUsed,
         start_hour = @startHour, start_minute = @startMinute, weekday = @weekday, status = @status, booking_date = @bookingDate
     WHERE id = @id AND manual_entry = 1`
  ).run({
    id,
    date,
    store,
    userName,
    revenue,
    hoursUsed,
    startHour,
    startMinute,
    weekday,
    status,
    bookingDate: bookingDate || null,
  });
  return db.prepare(`SELECT * FROM transactions WHERE id = ?`).get(id);
}

export function deleteManualSpaceMarketTransaction(id) {
  db.prepare(`DELETE FROM transactions WHERE id = ? AND manual_entry = 1`).run(id);
}

/** 利用者名入力のオートコンプリート候補(全チャネル・全期間の既存利用者名)。 */
export function listKnownUserNames() {
  return db
    .prepare(`SELECT DISTINCT user_name FROM transactions ORDER BY user_name`)
    .all()
    .map((r) => r.user_name);
}
