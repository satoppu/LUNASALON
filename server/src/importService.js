import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow } from "./importRows.js";
import { SUBSCRIPTION_STATUS, getTodayISO } from "./config.js";
import { detectRawFormat, mapRawBookingRow, mapRawSubscriptionRow, mapRawInstabaseRow } from "./rawImportMappers.js";
import { ensureStoreRegistered } from "./storeSettingsService.js";

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id)
`);

function insertRows(rows) {
  const seenStores = new Set(rows.map((r) => r.store));
  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const store of seenStores) ensureStoreRegistered(store);
    for (const r of rows) inserted += insertStmt.run(r).changes;
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return inserted;
}

function importSimpleCsv(parsed) {
  const rows = parsed.data.map(normalizeImportRow).filter(Boolean);
  if (rows.length === 0) {
    return { format: "simple", inserted: 0, skipped: parsed.data.length, error: "有効な行が見つかりませんでした。" };
  }
  const inserted = insertRows(rows);
  return { format: "simple", inserted, skipped: parsed.data.length - rows.length, duplicates: rows.length - inserted, error: null };
}

// The bundled historical CSVs predate external_id tracking, so INSERT OR
// IGNORE alone can't tell "already imported via a previous raw export" apart
// from "already covered by the original historical data". Only importing
// rows past the latest matching date already in transactions avoids
// double-counting revenue from that overlap (see rawImportMappers.js).
function importRawBookingCsv(parsed) {
  const since = db.prepare("SELECT MAX(date) AS d FROM transactions").get().d ?? "0000-00-00";
  let skippedPending = 0;
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;
  const rows = [];

  for (const raw of parsed.data) {
    if (raw["状態"] === "未確定") {
      skippedPending++;
      continue;
    }
    const row = mapRawBookingRow(raw);
    if (!row) {
      skippedUnparseable++;
      continue;
    }
    if (row.date <= since) {
      skippedAlreadyCovered++;
      continue;
    }
    rows.push(row);
  }

  const inserted = rows.length > 0 ? insertRows(rows) : 0;
  return {
    format: "rawBooking",
    inserted,
    duplicates: rows.length - inserted,
    skippedPending,
    skippedUnparseable,
    skippedAlreadyCovered,
    error: null,
  };
}

function importRawSubscriptionCsv(parsed) {
  const since = db.prepare("SELECT MAX(date) AS d FROM transactions WHERE status = ?").get(SUBSCRIPTION_STATUS).d ?? "0000-00-00";
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

  const inserted = rows.length > 0 ? insertRows(rows) : 0;
  return {
    format: "rawSubscription",
    inserted,
    duplicates: rows.length - inserted,
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

  const inserted = rows.length > 0 ? insertRows(rows) : 0;
  return {
    format: "rawInstabase",
    inserted,
    duplicates: rows.length - inserted,
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
