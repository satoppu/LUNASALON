import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow } from "./importRows.js";
import { SUBSCRIPTION_STATUS, isCancellationStatus, getTodayISO } from "./config.js";
import { detectRawFormat, mapRawBookingRow, mapRawSubscriptionRow, mapRawInstabaseRow, mapRawSpaceMarketRow } from "./rawImportMappers.js";
import { ensureStoreRegistered } from "./storeSettingsService.js";

// A plain INSERT (external_id NULL, from the simple template) never
// conflicts — SQLite's UNIQUE index treats each NULL as distinct. A raw
// export row with an external_id that's already in the table gets its
// fields refreshed instead of being ignored: this is how a 自社サイト
// booking transitions from PENDING_STATUS ("利用前") to "利用済み" (or to a
// cancellation) on a later export of the same 決済ID, without creating a
// duplicate row.
const upsertStmt = db.prepare(`
  INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, start_minute, weekday, channel, status, external_id, booking_date, revenue_confirmed_date, booking_amount, cancelled_date)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @start_minute, @weekday, @channel, @status, @external_id, @booking_date, @revenue_confirmed_date, @booking_amount, @cancelled_date)
  ON CONFLICT(external_id) DO UPDATE SET
    date = excluded.date,
    store = excluded.store,
    user_name = excluded.user_name,
    revenue = excluded.revenue,
    hours_used = excluded.hours_used,
    start_hour = excluded.start_hour,
    start_minute = excluded.start_minute,
    weekday = excluded.weekday,
    channel = excluded.channel,
    status = excluded.status,
    booking_date = excluded.booking_date,
    revenue_confirmed_date = excluded.revenue_confirmed_date,
    booking_amount = excluded.booking_amount,
    cancelled_date = excluded.cancelled_date
  WHERE external_id IS NOT NULL
`);
const selectExistingStmt = db.prepare(`
  SELECT date, store, user_name, revenue, hours_used, start_hour, start_minute, weekday, channel, status, booking_date, revenue_confirmed_date, booking_amount, cancelled_date
  FROM transactions WHERE external_id = ?
`);

// The source export carries no cancellation-date field for channels other
// than 自社サイト(which has revenue_confirmed_date instead — see
// rawImportMappers.js — so cancelled_date is only a fallback for it), so
// it's derived at import time instead: the first daily run that sees an
// *already-tracked* row's status switch to a cancellation status stamps
// today (JST) as cancelled_date, and later runs — cancelled or not — leave
// an already-stamped date alone rather than re-deriving it, since "today"
// would just be whenever that later run happened to execute, not the real
// cancellation date.
//
// Crucially, a row with no `existing` counterpart (external_id seen for the
// first time — e.g. historical data getting external_id-tracked for the
// first time, not a same-day new booking) must NOT stamp today either: that
// would misrecord a booking that was actually cancelled long ago as
// "cancelled today" just because today happens to be the first time this
// pipeline ever saw it. Only a genuine transition — a row we've seen before
// in a non-cancelled state, now cancelled — has real evidence for "today".
// leaving it null here falls through to the confirm-date fallback chain in
// newBookingsDaily.js (revenue_confirmed_date → cancelled_date →
// booking_date), which lands on booking_date instead: not perfectly
// accurate either, but far less wrong than a fabricated "cancelled today".
function computeCancelledDate(existing, incoming) {
  if (!isCancellationStatus(incoming.status)) return null;
  if (!existing) return null;
  if (isCancellationStatus(existing.status)) return existing.cancelled_date ?? null;
  return getTodayISO();
}

// Only these columns are actually written by upsertStmt's ON CONFLICT
// clause, so they're the only ones relevant to "did this row change".
const COMPARE_FIELDS = [
  "date",
  "store",
  "user_name",
  "revenue",
  "hours_used",
  "start_hour",
  "start_minute",
  "weekday",
  "channel",
  "status",
  "booking_date",
  "revenue_confirmed_date",
  "booking_amount",
];
function rowChanged(existing, incoming) {
  return COMPARE_FIELDS.some((f) => (existing[f] ?? null) !== (incoming[f] ?? null));
}

// inTransaction: true は、呼び出し側が既にBEGIN済みの時用(importRawBookingCsv
// がclaimLegacyRowsと1つのトランザクションにまとめるために使う)。SQLiteは
// トランザクションのネストができないため、その場合は自前でBEGIN/COMMITしない。
function insertRows(rows, { inTransaction = false } = {}) {
  const seenStores = new Set(rows.map((r) => r.store));
  let inserted = 0;
  let updated = 0;
  const run = () => {
    for (const store of seenStores) ensureStoreRegistered(store);
    for (const r of rows) {
      const existing = r.external_id ? selectExistingStmt.get(r.external_id) : undefined;
      if (!existing) {
        upsertStmt.run({ ...r, cancelled_date: computeCancelledDate(existing, r) });
        inserted++;
      } else if (rowChanged(existing, r)) {
        upsertStmt.run({ ...r, cancelled_date: computeCancelledDate(existing, r) });
        updated++;
      }
      // else: already present with identical values — counted as a
      // duplicate by callers (rows.length - inserted - updated), not written.
    }
  };
  if (inTransaction) {
    run();
  } else {
    db.exec("BEGIN");
    try {
      run();
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return { inserted, updated };
}

function importSimpleCsv(parsed) {
  const rows = parsed.data.map(normalizeImportRow).filter(Boolean);
  if (rows.length === 0) {
    return { format: "simple", inserted: 0, skipped: parsed.data.length, error: "有効な行が見つかりませんでした。" };
  }
  const { inserted } = insertRows(rows);
  return { format: "simple", inserted, skipped: parsed.data.length - rows.length, duplicates: rows.length - inserted, error: null };
}

// 予約枠を特定できる不変キー(利用日+店舗+利用者+開始時。分は古い履歴データに
// 無い行があるため使わない)。status/revenue/hours_usedはキャンセル等で後から
// 変わりうるため、あえてキーに含めない — 変わる前後で同じ枠だと突き合わせる
// のがこの関数の目的そのもの。
function legacyMatchKey(r) {
  return [r.date, r.store, r.user_name, r.start_hour].join("|");
}

// 履歴の一括インポート(external_idが無い、まだ紐付いていない行)は、この
// キーで今回のexportと突き合わせ、一致した行はexternal_idごと丸ごと今回の
// 内容に更新する(「このzipを正として、以後はexternal_idで追随できるように
// 紐付け直す」)。1つのキーに複数行が絡む場合(同一人物が同じ日・同じ店舗・
// 同じ開始時に複数回など)は誤って紐付けるくらいなら何もしない方が安全なので
// スキップする(claimSkippedAmbiguous)。external_idが既に別の行で使われて
// いる場合(履歴データと日次自動取り込みの両方に同じ予約が別行として入って
// しまっている重複)も、どちらが正しいか自動判断できないためスキップし
// (claimSkippedConflict)、利用者側で内容を見て手動で判断してもらう。
// 突き合わせで紐付けられなかった行は、以降の通常のexternal_idベースの
// upsert(insertRows)に回す — 既存なら更新、無ければ新規追加になる。
function claimLegacyRows(rows) {
  const legacyExisting = db
    .prepare(`SELECT id, date, store, user_name, start_hour FROM transactions WHERE external_id IS NULL AND channel = '自社サイト'`)
    .all();
  const legacyByKey = groupByKey(legacyExisting, legacyMatchKey);
  const fileByKey = groupByKey(rows, legacyMatchKey);

  const claimStmt = db.prepare(`
    UPDATE transactions SET
      date = @date, user_name = @user_name, revenue = @revenue, hours_used = @hours_used,
      start_hour = @start_hour, start_minute = @start_minute, weekday = @weekday, status = @status,
      external_id = @external_id, booking_date = @booking_date, revenue_confirmed_date = @revenue_confirmed_date,
      booking_amount = @booking_amount
    WHERE id = @id
  `);
  const externalIdTakenStmt = db.prepare(`SELECT 1 FROM transactions WHERE external_id = ? AND id != ?`);

  let claimed = 0;
  let claimSkippedAmbiguous = 0;
  let claimSkippedConflict = 0;
  const claimedRows = new Set();
  const ambiguousRows = new Set();

  for (const [key, fileRows] of fileByKey) {
    const dbRows = legacyByKey.get(key);
    if (!dbRows || dbRows.length === 0) continue; // 履歴に無い = 通常のインポートに任せる
    if (dbRows.length !== fileRows.length) {
      // どの履歴行に対応するか一意に決められない — 誤って紐付けるより、
      // この行はここでは何もしない方が安全。通常のinsertRowsにも回さない
      // (そのまま新規行として追加すると、既にある複数の履歴行のどれかと
      // 中身が重複する行をもう1件増やしてしまうため)。
      claimSkippedAmbiguous += fileRows.length;
      for (const fileRow of fileRows) ambiguousRows.add(fileRow);
      continue;
    }
    for (let i = 0; i < dbRows.length; i++) {
      const fileRow = fileRows[i];
      if (fileRow.external_id && externalIdTakenStmt.get(fileRow.external_id, dbRows[i].id)) {
        claimSkippedConflict++;
        continue;
      }
      claimStmt.run({
        date: fileRow.date,
        user_name: fileRow.user_name,
        revenue: fileRow.revenue,
        hours_used: fileRow.hours_used,
        start_hour: fileRow.start_hour,
        start_minute: fileRow.start_minute,
        weekday: fileRow.weekday,
        status: fileRow.status,
        external_id: fileRow.external_id,
        booking_date: fileRow.booking_date,
        revenue_confirmed_date: fileRow.revenue_confirmed_date,
        booking_amount: fileRow.booking_amount,
        id: dbRows[i].id,
      });
      claimed++;
      claimedRows.add(fileRow);
    }
  }

  return {
    claimed,
    claimSkippedAmbiguous,
    claimSkippedConflict,
    remainingRows: rows.filter((r) => !claimedRows.has(r) && !ambiguousRows.has(r)),
  };
}

function importRawBookingCsv(parsed) {
  let skippedUnparseable = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const row = mapRawBookingRow(raw);
    if (!row) {
      skippedUnparseable++;
      continue;
    }
    rows.push(row);
  }

  let claimed = 0;
  let claimSkippedAmbiguous = 0;
  let claimSkippedConflict = 0;
  let remainingRows = rows;
  let inserted = 0;
  let updated = 0;

  db.exec("BEGIN");
  try {
    ({ claimed, claimSkippedAmbiguous, claimSkippedConflict, remainingRows } = claimLegacyRows(rows));
    if (remainingRows.length > 0) ({ inserted, updated } = insertRows(remainingRows, { inTransaction: true }));
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    format: "rawBooking",
    inserted,
    updated,
    claimed,
    claimSkippedAmbiguous,
    claimSkippedConflict,
    duplicates: remainingRows.length - inserted - updated,
    skippedUnparseable,
    error: null,
  };
}

function importRawSubscriptionCsv(parsed) {
  const since =
    db.prepare("SELECT MAX(date) AS d FROM transactions WHERE status = ? AND external_id IS NULL").get(SUBSCRIPTION_STATUS).d ??
    "0000-00-00";
  let unresolvedOrBad = 0;
  let skippedAlreadyCovered = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const row = mapRawSubscriptionRow(raw);
    if (!row) {
      unresolvedOrBad++;
      continue;
    }
    if (row.date <= since) {
      skippedAlreadyCovered++;
      continue;
    }
    rows.push(row);
  }

  const { inserted, updated } = rows.length > 0 ? insertRows(rows) : { inserted: 0, updated: 0 };
  return {
    format: "rawSubscription",
    inserted,
    updated,
    duplicates: rows.length - inserted - updated,
    unresolvedOrBad,
    skippedAlreadyCovered,
    error: null,
  };
}

// Unlike the 自社サイト raw export, the historical data's Instabase coverage
// has gaps rather than a clean cutoff date (spot-checked: several Bellezza
// rows from early/mid the export period were missing from history while
// later Asteria rows were already present) — so a "since latest date" filter
// would both skip real new rows and let through nothing it shouldn't have.
// Content-based dedup (date+store+user+revenue against the historical rows,
// which have no external_id) is the safe check for this one; external_id
// still guards re-uploads of an export this path has already processed.
function importRawInstabaseCsv(parsed) {
  const existingHistorical = new Set(
    db
      .prepare(`SELECT date, store, user_name, revenue FROM transactions WHERE channel = 'Instabase' AND external_id IS NULL`)
      .all()
      .map((r) => `${r.date}|${r.store}|${r.user_name}|${r.revenue}`)
  );

  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const row = mapRawInstabaseRow(raw);
    if (!row) {
      skippedUnparseable++;
      continue;
    }
    const key = `${row.date}|${row.store}|${row.user_name}|${row.revenue}`;
    if (existingHistorical.has(key)) {
      skippedAlreadyCovered++;
      continue;
    }
    rows.push(row);
  }

  const { inserted, updated } = rows.length > 0 ? insertRows(rows) : { inserted: 0, updated: 0 };
  return {
    format: "rawInstabase",
    inserted,
    updated,
    duplicates: rows.length - inserted - updated,
    skippedUnparseable,
    skippedAlreadyCovered,
    error: null,
  };
}

// スペースマーケット has no pre-existing historical data in this table (it's
// a brand-new channel here), so a plain external_id-based upsert is enough —
// no "since" cutoff or content-based dedup needed the way 自社サイト/
// Instabase require to avoid double-counting against bundled historical CSVs.
function importRawSpaceMarketCsv(parsed) {
  let skippedUnparseable = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const row = mapRawSpaceMarketRow(raw);
    if (!row) {
      skippedUnparseable++;
      continue;
    }
    rows.push(row);
  }

  const { inserted, updated } = rows.length > 0 ? insertRows(rows) : { inserted: 0, updated: 0 };
  return {
    format: "rawSpaceMarket",
    inserted,
    updated,
    duplicates: rows.length - inserted - updated,
    skippedUnparseable,
    error: null,
  };
}

// Groups rows sharing the same content-derived key from date/store/user_name/
// revenue/status/hours_used. Used to line up a raw export's rows against
// already-imported transactions that have no external_id to match on
// directly (the historical bundled CSV predates that tracking).
function bookingContentKey(r) {
  return [r.date, r.store, r.user_name, r.revenue, r.status, Math.round(r.hours_used * 100)].join("|");
}

function groupByKey(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const key = keyFn(r);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

/**
 * Backfills `booking_date`, `revenue_confirmed_date`, and `booking_amount`
 * onto already-imported 自社サイト rows that predate external_id tracking
 * (the historical bundled CSV) and are still missing booking_amount, by
 * matching a raw booking export's rows to them on content (date, store,
 * user_name, revenue, status, hours_used) rather than 決済ID. Re-running this
 * after an earlier backfill (before booking_amount existed) is safe —
 * matched rows just get booking_amount filled in alongside unchanged
 * booking_date/revenue_confirmed_date values. A key where the file and the
 * DB don't have the exact same row count is left alone rather than guessed
 * at, so this can never misassign a date/amount to the wrong row — see
 * backfillMismatched in the result for anything that needs a closer look.
 */
export function backfillBookingDate(csvText) {
  const cleaned = csvText.replace(/^﻿/, "");
  const parsed = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
  const format = detectRawFormat(parsed.meta.fields);
  if (format !== "rawBooking") {
    return { format, backfillUpdated: 0, error: "この機能は自社サイトの予約エクスポートCSVのみ対応しています。" };
  }

  const rows = parsed.data.map(mapRawBookingRow).filter((r) => r && r.booking_date);
  const fileByKey = groupByKey(rows, bookingContentKey);

  const existing = db
    .prepare(
      `SELECT id, date, store, user_name, revenue, status, hours_used FROM transactions
       WHERE external_id IS NULL AND booking_amount IS NULL AND channel = '自社サイト'`
    )
    .all();
  const dbByKey = groupByKey(existing, bookingContentKey);

  let updated = 0;
  let mismatched = 0;
  let notFound = 0;
  const updateStmt = db.prepare(
    `UPDATE transactions SET booking_date = @booking_date, revenue_confirmed_date = @revenue_confirmed_date, booking_amount = @booking_amount WHERE id = @id`
  );
  db.exec("BEGIN");
  try {
    for (const [key, fileRows] of fileByKey) {
      const dbRows = dbByKey.get(key);
      if (!dbRows || dbRows.length === 0) {
        notFound += fileRows.length;
        continue;
      }
      if (dbRows.length !== fileRows.length) {
        mismatched += fileRows.length;
        continue;
      }
      for (let i = 0; i < dbRows.length; i++) {
        updateStmt.run({
          booking_date: fileRows[i].booking_date,
          revenue_confirmed_date: fileRows[i].revenue_confirmed_date,
          booking_amount: fileRows[i].booking_amount,
          id: dbRows[i].id,
        });
        updated++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { format, backfillUpdated: updated, backfillMismatched: mismatched, backfillNotFound: notFound, error: null };
}

/**
 * Appends valid rows (already parsed into an array of {column: value}
 * objects — from either Papa.parse or an xlsx sheet, both produce the same
 * shape) to the transactions table. Auto-detects five shapes: the
 * dashboard's own simple template, a raw 自社サイト booking export, a raw
 * 定期クーポン purchase export, a raw Instabase booking export, or a raw
 * スペースマーケット sales-detail export (see rawImportMappers.js). Unknown
 * stores are auto-registered in store_settings (spec 7.1).
 */
export function importParsedRows(rows) {
  const format = detectRawFormat(rows.length > 0 ? Object.keys(rows[0]) : []);
  const parsed = { data: rows };

  if (format === "rawBooking") return importRawBookingCsv(parsed);
  if (format === "rawSubscription") return importRawSubscriptionCsv(parsed);
  if (format === "rawInstabase") return importRawInstabaseCsv(parsed);
  if (format === "rawSpaceMarket") return importRawSpaceMarketCsv(parsed);
  return importSimpleCsv(parsed);
}

/** Same as importParsedRows, but parses the rows from raw CSV text first. */
export function importCsv(csvText) {
  const cleaned = csvText.replace(/^﻿/, "");
  const parsed = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
  return importParsedRows(parsed.data);
}
