// よやクルPro(自社サイト)には「予約変更」の機能が無く、変更は「キャンセル → 新しく予約」
// で行われる。同じお客様がキャンセルの前後30分以内に自社サイトで別の予約を入れていれば、
// そのキャンセルは取消ではなく「変更」、その予約は新規ではなく「変更後の予約」として扱う
// (キャンセル率・取消件数・予約件数に含めない。売上の計算はそのまま)。
//
// 時刻(booking_at / cancelled_at)は、時刻つきで取り込んだ行にしか無い。どちらかの時刻が
// 無い組み合わせは、「同じ日」かどうかで判定する。
import db from "./db.js";
import { isCancellationStatus } from "./config.js";

const OWN_SITE_CHANNEL = "自社サイト";
export const RESCHEDULE_WINDOW_MINUTES = 30;

/** キャンセルが処理された日(売り上げ確定日、無ければ取り込みで最初に気づいた日)。 */
export const cancelDateOf = (row) => row.revenue_confirmed_date || row.cancelled_date || null;

const toMs = (dateTime) => Date.parse(`${dateTime.replace(" ", "T")}+09:00`);

/** キャンセル行に対し、「変更後の予約」とみなせる予約かどうかと、その近さ(分)。 */
function closeness(cancel, booking) {
  if (cancel.cancelled_at && booking.booking_at) {
    const minutes = Math.abs(toMs(booking.booking_at) - toMs(cancel.cancelled_at)) / 60000;
    return minutes <= RESCHEDULE_WINDOW_MINUTES ? minutes : null;
  }
  // 時刻が無い行(古い取り込み分)は、同じ日かどうかで判定する。
  const d = cancelDateOf(cancel);
  return d && booking.booking_date === d ? RESCHEDULE_WINDOW_MINUTES : null;
}

/**
 * 全期間の自社サイトの行から「変更」の組を見つける。1つの予約は1つのキャンセルにだけ対応させる。
 * @returns {{ cancelIds: Set<number>, rebookIds: Set<number> }}
 */
export function loadReschedules() {
  const rows = db
    .prepare(
      `SELECT id, user_name, status, booking_date, booking_at, revenue_confirmed_date, cancelled_date, cancelled_at
       FROM transactions WHERE channel = ?`
    )
    .all(OWN_SITE_CHANNEL);
  const byUser = new Map();
  for (const r of rows) {
    if (!byUser.has(r.user_name)) byUser.set(r.user_name, []);
    byUser.get(r.user_name).push(r);
  }

  const cancelIds = new Set();
  const rebookIds = new Set();
  for (const userRows of byUser.values()) {
    const cancels = userRows
      .filter((r) => isCancellationStatus(r.status) && cancelDateOf(r))
      .sort((a, b) => String(a.cancelled_at ?? cancelDateOf(a)).localeCompare(String(b.cancelled_at ?? cancelDateOf(b))));
    for (const c of cancels) {
      let best = null;
      for (const b of userRows) {
        if (b.id === c.id || rebookIds.has(b.id)) continue;
        const m = closeness(c, b);
        if (m != null && (!best || m < best.m)) best = { id: b.id, m };
      }
      if (best) {
        cancelIds.add(c.id);
        rebookIds.add(best.id);
      }
    }
  }
  return { cancelIds, rebookIds };
}

/** 行の配列に印を付ける: rescheduled(変更によるキャンセル)/ rebooking(変更後の予約)。 */
export function markReschedules(rows, info = loadReschedules()) {
  for (const r of rows) {
    if (info.cancelIds.has(r.id)) r.rescheduled = true;
    if (info.rebookIds.has(r.id)) r.rebooking = true;
  }
  return rows;
}
