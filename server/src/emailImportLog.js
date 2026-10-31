// 予約サイトの通知メール取り込み(spaceMarketEmail.js / instabaseEmail.js)で共通の、
// 「どのメールを処理したか」の記録。同じメールを二度反映しないために使う。
import db from "./db.js";
import { getTodayISO } from "./config.js";

export function toISODateJST(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

const isProcessed = (messageId) => Boolean(db.prepare(`SELECT 1 FROM email_import_log WHERE message_id = ?`).get(messageId));

function log(source, messageId, receivedDate, kind, bookingId, summary) {
  db.prepare(
    `INSERT INTO email_import_log (message_id, source, received_date, kind, booking_id, summary) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(messageId, source, receivedDate, kind, bookingId ?? null, summary);
}

/**
 * メール1通を解析・反映し、記録する(DBの変更と記録は1つのトランザクション)。
 * 既に記録済みのメールは何もしない。
 * @param {(e: object, receivedDate: string, subject: string) => {ok: boolean, silent?: boolean, summary: string}} apply
 * @returns {{ skipped: true } | { kind: string, ok: boolean, silent?: boolean, summary: string }}
 */
export function processEmailOnce(source, { messageId, subject, text, date }, parse, apply) {
  if (isProcessed(messageId)) return { skipped: true };
  const receivedDate = date ? toISODateJST(date) : getTodayISO();
  const e = parse({ subject, text });
  db.exec("BEGIN");
  try {
    const result = apply(e, receivedDate, subject);
    log(source, messageId, receivedDate, e.kind, e.bookingId, result.summary);
    db.exec("COMMIT");
    return { kind: e.kind, ...result };
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** 反映はせず「処理済み」の印だけ付ける(導入時、手入力・CSV取り込み済みの過去分と二重にしないため)。 */
export function markEmailBaseline(source, { messageId, subject, text, date }, parse) {
  if (isProcessed(messageId)) return false;
  log(source, messageId, date ? toISODateJST(date) : getTodayISO(), "baseline", parse({ subject, text }).bookingId, `導入前のメール(反映せず): ${subject}`);
  return true;
}
