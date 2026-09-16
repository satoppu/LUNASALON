import Papa from "papaparse";
import db from "./db.js";
import { normalizeImportRow } from "./importRows.js";
import { ensureStoreRegistered } from "./storeSettingsService.js";

const insertStmt = db.prepare(`
  INSERT INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status)
`);

/**
 * Parses a CSV buffer and appends valid rows to the transactions table.
 * Unknown stores are auto-registered in store_settings (spec 7.1: "新しい
 * 予約データを追加・更新できるCSVインポート機能").
 */
export function importCsv(csvText) {
  const cleaned = csvText.replace(/^﻿/, "");
  const parsed = Papa.parse(cleaned, { header: true, skipEmptyLines: true });
  const rows = parsed.data.map(normalizeImportRow).filter(Boolean);

  if (rows.length === 0) {
    return { inserted: 0, skipped: parsed.data.length, error: "有効な行が見つかりませんでした。" };
  }

  const seenStores = new Set(rows.map((r) => r.store));
  db.exec("BEGIN");
  try {
    for (const store of seenStores) ensureStoreRegistered(store);
    for (const r of rows) insertStmt.run(r);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return { inserted: rows.length, skipped: parsed.data.length - rows.length, error: null };
}
