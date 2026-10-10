// インスタベースからの通知メール(noreply@instabase.jp → info@lunasalon.jp)を読み取り、
// Instabase チャネルの実績として反映する。メールの受信自体は emailImport.js。
//
// 対応しているメール(2026年9〜10月の実物で確認した形):
//   - 【要確認】予約が入りました       → 予約として登録(予約ID・スペース・氏名・利用日時・利用料金)
//   - 予約内容の変更が確定いたしました → 変更後の内容で更新(このメールに全項目が載っている)
//   - 【予約キャンセル】…              → キャンセルに変更(キャンセル料金があれば売上に残す)
//   - 見学リクエスト                   → 売上には関係しないため登録せず、毎朝のメールで知らせるだけ
// それ以外(承認待ちの予約リクエストなど)は反映せず、毎朝のメールで知らせる。
//
// external_id は予約IDそのまま(Instabase の CSV 取り込みと同じ)。後で CSV を取り込んでも
// 同じ行が更新されるだけで二重にはならない。
import db from "./db.js";
import { getTodayISO, PENDING_STATUS } from "./config.js";
import { canonicalizeUserName } from "./importHelpers.js";
import { findInstabaseStore } from "./rawImportMappers.js";
import { computeFields } from "./manualTransactionsService.js";

const INSTABASE_CHANNEL = "Instabase";

const yenToNumber = (s) => Number(String(s).replace(/,/g, ""));
const pad2 = (n) => String(n).padStart(2, "0");
// "2026年09月04日(金) 13時30分" 形式(NFKC後)の日付・時刻を取り出す正規表現の部品。
const DATE_RE = String.raw`(\d{4})年(\d{1,2})月(\d{1,2})日\s*\(.\)`;
const TIME_RE = String.raw`(\d{1,2})時(\d{2})分`;
const isoDate = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;

export function parseInstabaseEmail({ subject = "", text = "" }) {
  const body = String(text).normalize("NFKC").replace(/\s+/g, " ");
  const subj = String(subject).normalize("NFKC");

  const bookingId = body.match(/予約ID:\s*(\d{6,})/)?.[1] ?? null;
  const spaceName = body.match(/(?:予約スペース|スペース|希望スペース):\s*(.+?)\s*(?:お客様氏名|見学者氏名|https?:|利用予定日)/)?.[1] ?? null;
  const rawName = body.match(/(?:お客様氏名|見学者氏名):\s*(.+?)様/)?.[1] ?? null;
  const u = body.match(new RegExp(`利用日時:\\s*${DATE_RE}\\s*${TIME_RE}\\s*[~〜ー-]\\s*${TIME_RE}`));
  const period = u ? { date: isoDate(u[1], u[2], u[3]), startTime: `${pad2(u[4])}:${u[5]}`, endTime: `${pad2(u[6])}:${u[7]}` } : null;
  const total = body.match(/利用料金:\s*([\d,]+)円/)?.[1];
  const cancelFee = body.match(/キャンセル料金:\s*([\d,]+)円/)?.[1];
  const c = body.match(new RegExp(`キャンセル日時:\\s*${DATE_RE}`));
  const v = body.match(new RegExp(`見学希望日時:\\s*\\S*\\s*${DATE_RE}\\s*${TIME_RE}`));

  let kind = "unknown";
  // 予約に関係しない通知(メッセージ・レビュー・掲載ページの編集反映・支払明細・
  // 件名が「[インスタベース]」で始まるお知らせ)は何も知らせずに読み飛ばす。
  if (/メッセージ|レビュー|編集内容が反映|支払明細/.test(subj) || /^\[インスタベース\]/.test(subj)) kind = "ignored";
  else if (/キャンセル/.test(subj)) kind = "cancel";
  else if (/見学リクエスト/.test(subj)) kind = "visit";
  else if (/変更/.test(subj) && /確定/.test(subj)) kind = "change";
  else if (/予約が入りました|予約が確定|予約確定/.test(subj)) kind = "booking";
  // 予約・キャンセル・見学のどれとも読めない件名は、予約に関係しそうなものだけ【要確認】に回す。
  else if (!/予約|見学/.test(subj)) kind = "ignored";

  return {
    kind,
    bookingId,
    userName: rawName ? canonicalizeUserName(rawName) : null,
    spaceName,
    store: spaceName ? findInstabaseStore(spaceName) : null,
    period,
    total: total != null ? yenToNumber(total) : null,
    cancelFee: cancelFee != null ? yenToNumber(cancelFee) : null,
    cancelledDate: c ? isoDate(c[1], c[2], c[3]) : null,
    visit: v ? { date: isoDate(v[1], v[2], v[3]), time: `${pad2(v[4])}:${v[5]}` } : null,
  };
}

// node:sqlite は SQL に無い名前付きパラメータを渡すとエラーになるため、使う列だけ渡す。
const pick = (obj, keys) => Object.fromEntries(keys.map((k) => [k, obj[k]]));
const selectByExternalId = db.prepare(`SELECT * FROM transactions WHERE external_id = ?`);

function describe(row) {
  const time = row.start_hour != null ? ` ${pad2(row.start_hour)}:${pad2(row.start_minute ?? 0)}〜` : "";
  return `${row.date.slice(5).replace("-", "/")}${time} ${row.store} ${row.user_name} ¥${Number(row.revenue).toLocaleString("ja-JP")}`;
}

function applyBooking(e, receivedDate, label) {
  if (!e.bookingId || !e.period || e.total == null || !e.userName) return { ok: false, summary: `${label}メールの内容を読み取れませんでした` };
  if (!e.store) return { ok: false, summary: `スペース名から店舗を判定できませんでした(${e.spaceName})` };

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
    external_id: e.bookingId,
    booking_date: receivedDate,
  };
  const UPDATE_KEYS = ["date", "store", "user_name", "revenue", "hours_used", "start_hour", "start_minute", "weekday", "status"];

  const existing = selectByExternalId.get(e.bookingId);
  if (existing) {
    db.prepare(
      `UPDATE transactions SET date=@date, store=@store, user_name=@user_name, revenue=@revenue, hours_used=@hours_used,
         start_hour=@start_hour, start_minute=@start_minute, weekday=@weekday, status=@status WHERE id=@id`
    ).run({ ...pick(values, UPDATE_KEYS), id: existing.id });
    return { ok: true, summary: `${label}(更新): ${describe({ ...existing, ...values })}` };
  }

  // 予約IDの無い過去の取り込み行(同じ日・店舗・利用者)があれば、新しく足さずにその行を使う。
  const legacy = db
    .prepare(
      `SELECT * FROM transactions WHERE channel = ? AND external_id IS NULL AND date = ? AND store = ? AND user_name = ?
       ORDER BY (start_hour = ?) DESC, id LIMIT 1`
    )
    .get(INSTABASE_CHANNEL, values.date, values.store, values.user_name, values.start_hour);
  if (legacy) {
    db.prepare(
      `UPDATE transactions SET revenue=@revenue, hours_used=@hours_used, start_hour=@start_hour, start_minute=@start_minute,
         weekday=@weekday, status=@status, external_id=@external_id, booking_date=COALESCE(booking_date, @booking_date) WHERE id=@id`
    ).run({
      ...pick(values, ["revenue", "hours_used", "start_hour", "start_minute", "weekday", "status", "external_id", "booking_date"]),
      id: legacy.id,
    });
    return { ok: true, summary: `${label}(既存の行に反映): ${describe({ ...legacy, ...values })}` };
  }

  db.prepare(
    `INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, start_minute, weekday, channel, status, external_id, booking_date)
     VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @start_minute, @weekday, @channel, @status, @external_id, @booking_date)`
  ).run({ ...values, channel: INSTABASE_CHANNEL });
  return { ok: true, summary: `${label}(新規): ${describe(values)}` };
}

function applyCancel(e, receivedDate) {
  if (!e.bookingId) return { ok: false, summary: "キャンセルメールの内容を読み取れませんでした" };
  let existing = selectByExternalId.get(e.bookingId);
  if (!existing) {
    // 取り込み前の予約などで元の行が無ければ、キャンセルメールの内容から作る。
    const created = applyBooking(e, null, "予約");
    if (!created.ok) return { ok: false, summary: `キャンセル(予約ID ${e.bookingId}): ${created.summary}` };
    existing = selectByExternalId.get(e.bookingId);
  }
  const fee = e.cancelFee ?? 0;
  const status = fee > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  db.prepare(`UPDATE transactions SET status = ?, revenue = ?, hours_used = 0, cancelled_date = ? WHERE id = ?`).run(
    status,
    fee,
    e.cancelledDate ?? receivedDate,
    existing.id
  );
  return { ok: true, summary: `キャンセル: ${describe({ ...existing, revenue: fee })}(キャンセル料金 ¥${fee.toLocaleString("ja-JP")})` };
}

/** 解析済みのメール1通をDBに反映する(記録は emailImportLog.js の processEmailOnce が行う)。 */
export function applyInstabaseEmail(e, receivedDate, subject) {
  if (e.kind === "booking") return applyBooking(e, receivedDate, "予約");
  if (e.kind === "change") return applyBooking(e, receivedDate, "予約変更");
  if (e.kind === "cancel") return applyCancel(e, receivedDate);
  if (e.kind === "visit") {
    const when = e.visit ? `${e.visit.date.slice(5).replace("-", "/")} ${e.visit.time}` : "日時不明";
    return { ok: true, summary: `見学: ${when} ${e.store ?? e.spaceName ?? ""} ${e.userName ?? ""}(売上には反映しません)` };
  }
  if (e.kind === "ignored") return { ok: true, silent: true, summary: `対象外: ${subject}` };
  return { ok: false, summary: `未対応のメールのため反映していません: ${subject}` };
}
