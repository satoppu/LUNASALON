import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow } from "./importRows.js";
import { SUBSCRIPTION_STATUS, PENDING_STATUS, getTodayISO } from "./config.js";
import { detectRawFormat, mapRawBookingRow, mapRawSubscriptionRow, mapRawInstabaseRow } from "./rawImportMappers.js";
import { ensureStoreRegistered } from "./storeSettingsService.js";

// A plain INSERT (external_id NULL, from the simple template) never
// conflicts — SQLite's UNIQUE index treats each NULL as distinct. A raw
// export row with an external_id that's already in the table gets its
// fields refreshed instead of being ignored: this is how a 自社サイト
// booking transitions from PENDING_STATUS ("利用前") to "利用済み" (or to a
// cancellation) on a later export of the same 決済ID, without creating a
// duplicate row.
const upsertStmt = db.prepare(`
  INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id)
  ON CONFLICT(external_id) DO UPDATE SET
    date = excluded.date,
    store = excluded.store,
    user_name = excluded.user_name,
    revenue = excluded.revenue,
    hours_used = excluded.hours_used,
    start_hour = excluded.start_hour,
    weekday = excluded.weekday,
    channel = excluded.channel,
    status = excluded.status
  WHERE external_id IS NOT NULL
`);
const existsStmt = db.prepare(`SELECT 1 FROM transactions WHERE external_id = ?`);

function insertRows(rows) {
  const seenStores = new Set(rows.map((r) => r.store));
  let inserted = 0;
  let updated = 0;
  db.exec("BEGIN");
  try {
    for (const store of seenStores) ensureStoreRegistered(store);
    for (const r of rows) {
      const alreadyExists = r.external_id ? !!existsStmt.get(r.external_id) : false;
      upsertStmt.run(r);
      if (alreadyExists) updated++;
      else inserted++;
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
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

// The bundled historical CSVs predate external_id tracking, so the upsert
// alone can't tell "already imported via a previous raw export" apart from
// "already covered by the original historical data". Only importing rows
// past the latest matching date among those *historical* (external_id-less)
// rows avoids double-counting revenue from that overlap — computed that way,
// rather than as a plain MAX(date) over the whole table, so it stays fixed
// even as later imports add PENDING_STATUS ("利用前") rows dated months into
// the future (see rawImportMappers.js). PENDING_STATUS itself is exempt from
// this cutoff entirely: that status didn't exist in the historical export
// (未確定 rows were skipped outright before this pipeline handled them), so a
// row mapped to it can never actually be historical-CSV ground, even when its
// date happens to land on/before the cutoff (e.g. a same-day booking for
// later today, dated the same as the cutoff day itself).
function importRawBookingCsv(parsed) {
  const since = db.prepare("SELECT MAX(date) AS d FROM transactions WHERE external_id IS NULL").get().d ?? "0000-00-00";
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const row = mapRawBookingRow(raw);
    if (!row) {
      skippedUnparseable++;
      continue;
    }
    if (row.date <= since && row.status !== PENDING_STATUS) {
      skippedAlreadyCovered++;
      continue;
    }
    rows.push(row);
  }

  const { inserted, updated } = rows.length > 0 ? insertRows(rows) : { inserted: 0, updated: 0 };
  return {
    format: "rawBooking",
    inserted,
    updated,
    duplicates: rows.length - inserted - updated,
    skippedUnparseable,
    skippedAlreadyCovered,
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
  const today = getTodayISO();
  const existingHistorical = new Set(
    db
      .prepare(`SELECT date, store, user_name, revenue FROM transactions WHERE channel = 'Instabase' AND external_id IS NULL`)
      .all()
      .map((r) => `${r.date}|${r.store}|${r.user_name}|${r.revenue}`)
  );

  let skippedPending = 0;
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;
  const rows = [];

  for (const raw of parsed.data) {
    const date = String(raw["利用開始日時"] || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date > today) {
      skippedPending++;
      continue;
    }
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
    skippedPending,
    skippedUnparseable,
    skippedAlreadyCovered,
    error: null,
  };
}

/**
 * Parses an uploaded CSV and appends valid rows to the transactions table.
 * Auto-detects four shapes: the dashboard's own simple template, a raw
 * 自社サイト booking export, a raw 定期クーポン purchase export, or a raw
 * Instabase booking export (see rawImportMappers.js). Unknown stores are
 * auto-registered in store_settings (spec 7.1).
 */
export function importCsv(csvText) {
  const cleaned = csvText.replace(/^﻿/, "");
  const parsed = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
  const format = detectRawFormat(parsed.meta.fields);

  if (format === "rawBooking") return importRawBookingCsv(parsed);
  if (format === "rawSubscription") return importRawSubscriptionCsv(parsed);
  if (format === "rawInstabase") return importRawInstabaseCsv(parsed);
  return importSimpleCsv(parsed);
}
