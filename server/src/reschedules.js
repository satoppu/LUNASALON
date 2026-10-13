// よやクルPro(自社サイト)には「予約変更」の機能が無く、変更は「キャンセル → 新しく予約」
// で行われる。そのため、同じお客様がキャンセルしたその日に自社サイトで別の予約を入れて
// いれば、そのキャンセルは取消ではなく「変更」として扱う(キャンセル率・取消件数に
// 含めない)。時刻までは記録していないため、同じ日かどうかで判定する。
import db from "./db.js";
import { isCancellationStatus } from "./config.js";

const OWN_SITE_CHANNEL = "自社サイト";

/** キャンセルが処理された日(売り上げ確定日、無ければ取り込みで最初に気づいた日)。 */
export const cancelDateOf = (row) => row.revenue_confirmed_date || row.cancelled_date || null;

const key = (user, date) => `${user}|${date}`;

/** 自社サイトの「お客様×予約日」ごとの予約件数(キャンセル済みの予約も含む)。 */
export function loadOwnSiteBookingCounts() {
  const rows = db
    .prepare(
      `SELECT user_name, booking_date, COUNT(*) AS c FROM transactions
       WHERE channel = ? AND booking_date IS NOT NULL GROUP BY user_name, booking_date`
    )
    .all(OWN_SITE_CHANNEL);
  return new Map(rows.map((r) => [key(r.user_name, r.booking_date), r.c]));
}

/** このキャンセルが「変更」(同じ日に同じお客様が別の予約を入れている)かどうか。 */
export function isRescheduleCancel(row, counts) {
  if (row.channel !== OWN_SITE_CHANNEL || !isCancellationStatus(row.status)) return false;
  const d = cancelDateOf(row);
  if (!d) return false;
  // 予約したその日にキャンセルした場合、自分自身の予約は数えない。
  const others = (counts.get(key(row.user_name, d)) || 0) - (row.booking_date === d ? 1 : 0);
  return others > 0;
}

/** 行の配列に rescheduled: true の印を付ける(集計で取消と変更を分けるため)。 */
export function markReschedules(rows, counts = loadOwnSiteBookingCounts()) {
  for (const r of rows) if (isRescheduleCancel(r, counts)) r.rescheduled = true;
  return rows;
}

/** 取消として数えるキャンセルか(「変更」を除く)。 */
export const isRealCancellation = (row) => isCancellationStatus(row.status) && !row.rescheduled;
