// スペースマーケットからの通知メール(no-reply@spacemarket.com → luna@mj-japan.net)
// を読み取り、「設定→記録」のスペースマーケット手動入力の行として反映する。
// メールの受信自体は spaceMarketMailbox.js、ここは本文の解析と DB への反映だけ。
//
// 対応しているメール(2026年9〜10月の実物で確認した形):
//   - 【今すぐ予約】…            → 予約として登録(予約ID・お名前・スペース名・利用期間・合計)
//   - 【予約内容の変更リクエスト】…   → 変更後の内容を保存しておくだけ(まだ反映しない)
//   - 【予約内容の変更リクエスト：承諾】… → 保存しておいた変更後の内容で更新(承諾メール
//                                     自体には金額しか載っていないため。リクエストが
//                                     見つからなければ金額だけ更新し、時間は手で確認)
//   - 変更リクエストの却下          → 保存しておいた変更内容を破棄
//   - キャンセルが完了しました…    → キャンセルに変更(払い戻し料金を差し引いた分を売上に残す)
// それ以外(承認待ちの予約リクエストなど)は反映せず、毎朝のメールで知らせる。
import db from "./db.js";
import { getTodayISO, PENDING_STATUS } from "./config.js";
import { canonicalizeUserName } from "./importHelpers.js";
import { findSpaceMarketStore } from "./rawImportMappers.js";
import { computeFields } from "./manualTransactionsService.js";

const SPACEMARKET_CHANNEL = "スペースマーケット";

// 予約IDはInstabaseなど他チャネルの数字IDと external_id が衝突しないよう接頭辞を付ける。
const externalIdFor = (bookingId) => `sm-${bookingId}`;

function toISODateJST(date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(date);
}

const yenToNumber = (s) => Number(String(s).replace(/[,，]/g, ""));
const pad2 = (n) => String(n).padStart(2, "0");

/**
 * メール1通を解析する。text はプレーンテキスト(HTMLメールなら変換後)。
 * 改行や表のレイアウトに左右されないよう、空白をすべて1つにまとめてから
 * 見出し(予約ID・お名前…)を目印に値を取り出す。
 */
export function parseSpaceMarketEmail({ subject = "", text = "" }) {
  const body = String(text).normalize("NFKC").replace(/\s+/g, " ");
  const subj = String(subject).normalize("NFKC");

  const bookingId = body.match(/予約ID\s*(\d{4,})/)?.[1] ?? null;
  const userName = body.match(/お名前\s*(.+?)\s*法人・団体名/)?.[1]?.trim() ?? null;
  const spaceName = body.match(/スペース名\s*(.+?)\s*住所/)?.[1]?.trim() ?? null;
  const total = body.match(/合計\s*[¥￥]\s*([\d,]+)/)?.[1];
  const refund = body.match(/払い戻し料金\s*[¥￥]\s*([\d,]+)/)?.[1];
  const p = body.match(/利用期間\s*(\d{4})\/(\d{1,2})\/(\d{1,2})\s*\(.\)\s*(\d{1,2}):(\d{2})\s*[~〜～ー-]\s*(\d{1,2}):(\d{2})/);
  const period = p
    ? { date: `${p[1]}-${pad2(p[2])}-${pad2(p[3])}`, startTime: `${pad2(p[4])}:${p[5]}`, endTime: `${pad2(p[6])}:${p[7]}` }
    : null;

  let kind = "unknown";
  if (/キャンセル/.test(subj) || /キャンセルされました/.test(body)) kind = "cancel";
  else if (/変更/.test(subj) && /承諾/.test(subj)) kind = "change";
  else if (/変更/.test(subj) && /却下/.test(subj)) kind = "changeRejected";
  else if (/変更リクエスト/.test(subj)) kind = "changeRequest";
  else if (/今すぐ予約/.test(subj) || /予約が確定/.test(subj) || /予約(リクエスト)?を承認/.test(subj)) kind = "booking";

  return {
    kind,
    bookingId,
    userName: userName ? canonicalizeUserName(userName) : null,
    spaceName,
    store: spaceName ? findSpaceMarketStore(spaceName) : null,
    period,
    total: total != null ? yenToNumber(total) : null,
    refund: refund != null ? yenToNumber(refund) : null,
  };
}

// node:sqlite は SQL に無い名前付きパラメータを渡すとエラーになるため、使う列だけ渡す。
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));

const selectByExternalId = db.prepare(`SELECT * FROM transactions WHERE external_id = ?`);

function describe(row) {
  const time = row.start_hour != null ? ` ${pad2(row.start_hour)}:${pad2(row.start_minute ?? 0)}〜` : "";
  return `${row.date.slice(5).replace("-", "/")}${time} ${row.store} ${row.user_name} ¥${Number(row.revenue).toLocaleString("ja-JP")}`;
}

function applyBooking(e, receivedDate) {
  if (!e.bookingId || !e.period || e.total == null || !e.userName) return { ok: false, summary: "予約メールの内容を読み取れませんでした" };
  if (!e.store) return { ok: false, summary: `スペース名から店舗を判定できませんでした(${e.spaceName})` };

  const externalId = externalIdFor(e.bookingId);
  const status = e.period.date > getTodayISO() ? PENDING_STATUS : "利用済み";
  const f = computeFields({ date: e.period.date, status, startTime: e.period.startTime, endTime: e.period.endTime });
  const values = {
    date: e.period.date,
    store: e.store,
    user_name: e.userName,
    revenue: e.total,
    hours_used: f.hoursUsed,
    start_hour: f.startHour,
    start_minute: f.startMinute,
    weekday: f.weekday,
    status,
    external_id: externalId,
    booking_date: receivedDate,
  };

  const existing = selectByExternalId.get(externalId);
  if (existing) {
    db.prepare(
      `UPDATE transactions SET date=@date, store=@store, user_name=@user_name, revenue=@revenue, hours_used=@hours_used,
         start_hour=@start_hour, start_minute=@start_minute, weekday=@weekday, status=@status WHERE id=@id`
    ).run({ ...pick(values, ["date", "store", "user_name", "revenue", "hours_used", "start_hour", "start_minute", "weekday", "status"]), id: existing.id });
    return { ok: true, summary: `予約(更新): ${describe({ ...existing, ...values })}` };
  }

  // 手入力済みの同じ予約(予約IDなし・同じ日・店舗・利用者)があれば、新しく足さずにその行を使う。
  const handEntered = db
    .prepare(
      `SELECT * FROM transactions WHERE manual_entry = 1 AND external_id IS NULL AND date = ? AND store = ? AND user_name = ?
       ORDER BY (start_hour = ?) DESC, id LIMIT 1`
    )
    .get(values.date, values.store, values.user_name, values.start_hour);
  if (handEntered) {
    db.prepare(
      `UPDATE transactions SET revenue=@revenue, hours_used=@hours_used, start_hour=@start_hour, start_minute=@start_minute,
         weekday=@weekday, status=@status, external_id=@external_id, booking_date=COALESCE(booking_date, @booking_date) WHERE id=@id`
    ).run({
      ...pick(values, ["revenue", "hours_used", "start_hour", "start_minute", "weekday", "status", "external_id", "booking_date"]),
      id: handEntered.id,
    });
    return { ok: true, summary: `予約(手入力済みの行に反映): ${describe({ ...handEntered, ...values })}` };
  }

  db.prepare(
    `INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, start_minute, weekday, channel, status, external_id, booking_date, manual_entry)
     VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @start_minute, @weekday, @channel, @status, @external_id, @booking_date, 1)`
  ).run({ ...values, channel: SPACEMARKET_CHANNEL });
  return { ok: true, summary: `予約(新規): ${describe(values)}` };
}

function applyChangeRequest(e, receivedDate) {
  if (!e.bookingId || !e.period || e.total == null) return { ok: false, summary: "予約変更リクエストのメールの内容を読み取れませんでした" };
  db.prepare(
    `INSERT INTO spacemarket_change_requests (booking_id, details_json, received_date) VALUES (?, ?, ?)
     ON CONFLICT(booking_id) DO UPDATE SET details_json = excluded.details_json, received_date = excluded.received_date`
  ).run(e.bookingId, JSON.stringify(e), receivedDate);
  const p = e.period;
  return {
    ok: true,
    summary: `予約変更リクエスト(承諾待ち・未反映): ${p.date.slice(5).replace("-", "/")} ${p.startTime}〜${p.endTime} ${e.store ?? e.spaceName} ${e.userName} ¥${e.total.toLocaleString("ja-JP")}`,
  };
}

function applyChange(e, receivedDate) {
  if (!e.bookingId || e.total == null) return { ok: false, summary: "予約変更メールの内容を読み取れませんでした" };
  const request = db.prepare(`SELECT details_json FROM spacemarket_change_requests WHERE booking_id = ?`).get(e.bookingId);
  if (request) {
    const requested = JSON.parse(request.details_json);
    const r = applyBooking({ ...requested, total: e.total }, receivedDate);
    db.prepare(`DELETE FROM spacemarket_change_requests WHERE booking_id = ?`).run(e.bookingId);
    return r.ok ? { ok: true, summary: r.summary.replace(/^予約\((新規|更新)\)/, "予約変更(承諾)") } : r;
  }
  const existing = selectByExternalId.get(externalIdFor(e.bookingId));
  if (!existing) return { ok: false, summary: `予約変更(予約ID ${e.bookingId})の元の予約が見つかりませんでした。手入力で確認してください` };
  db.prepare(`UPDATE transactions SET revenue = ? WHERE id = ?`).run(e.total, existing.id);
  return {
    ok: true,
    summary: `予約変更: ${describe({ ...existing, revenue: e.total })}(金額のみ反映。変更後の時間は「設定→記録」で確認してください)`,
  };
}

function applyCancel(e, receivedDate) {
  if (!e.bookingId) return { ok: false, summary: "キャンセルメールの内容を読み取れませんでした" };
  const externalId = externalIdFor(e.bookingId);
  let existing = selectByExternalId.get(externalId);
  if (!existing) {
    // 予約メールより前の分などで元の行が無ければ、キャンセルメールの内容から作る。
    const created = applyBooking({ ...e, kind: "booking" }, null);
    if (!created.ok) return { ok: false, summary: `キャンセル(予約ID ${e.bookingId}): ${created.summary}` };
    existing = selectByExternalId.get(externalId);
  }
  const total = e.total ?? existing.revenue;
  const kept = Math.max(0, total - (e.refund ?? 0));
  const status = kept > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  db.prepare(`UPDATE transactions SET status = ?, revenue = ?, hours_used = 0, cancelled_date = ? WHERE id = ?`).run(
    status,
    kept,
    receivedDate,
    existing.id
  );
  return { ok: true, summary: `キャンセル: ${describe({ ...existing, revenue: kept })}(払い戻し ¥${(e.refund ?? 0).toLocaleString("ja-JP")})` };
}

/**
 * 解析済みのメール1通を反映し、ログに記録する。既にログにあるメールは何もしない。
 * @returns {{ skipped: true } | { kind: string, ok: boolean, summary: string }}
 */
export function applySpaceMarketEmail({ messageId, subject, text, date }) {
  if (db.prepare(`SELECT 1 FROM spacemarket_email_log WHERE message_id = ?`).get(messageId)) return { skipped: true };
  const receivedDate = date ? toISODateJST(date) : getTodayISO();
  const e = parseSpaceMarketEmail({ subject, text });

  let result;
  db.exec("BEGIN");
  try {
    if (e.kind === "booking") result = applyBooking(e, receivedDate);
    else if (e.kind === "changeRequest") result = applyChangeRequest(e, receivedDate);
    else if (e.kind === "change") result = applyChange(e, receivedDate);
    else if (e.kind === "changeRejected") {
      if (e.bookingId) db.prepare(`DELETE FROM spacemarket_change_requests WHERE booking_id = ?`).run(e.bookingId);
      result = { ok: true, summary: `予約変更リクエストの却下(予約ID ${e.bookingId ?? "不明"})` };
    }
    else if (e.kind === "cancel") result = applyCancel(e, receivedDate);
    else result = { ok: false, summary: `未対応のメールのため反映していません: ${subject}` };
    db.prepare(`INSERT INTO spacemarket_email_log (message_id, received_date, kind, booking_id, summary) VALUES (?, ?, ?, ?, ?)`).run(
      messageId,
      receivedDate,
      e.kind,
      e.bookingId,
      result.summary
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { kind: e.kind, ...result };
}

/**
 * 利用日を過ぎた手入力(メール取り込み含む)の「利用前」行を「利用済み」にする。
 * CSV取り込みの行は毎回のインポートで更新されるが、手入力の行は誰も更新しないため。
 */
export function promotePastManualPendingRows() {
  return db
    .prepare(`UPDATE transactions SET status = '利用済み' WHERE manual_entry = 1 AND status = ? AND date < ?`)
    .run(PENDING_STATUS, getTodayISO()).changes;
}
