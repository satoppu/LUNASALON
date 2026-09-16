// Imports a raw 定額クーポン (subscription) purchase export straight from the
// reservation platform (columns: クーポン名,顧客名,金額,返金額,利益,支払いID,
// 購入日時). Unlike server/src/importSubscriptions.js (which reads the older
// bundled Excel "データ" sheet), this reads the platform's own coupon-sales
// CSV export directly.
//
// These rows aren't tied to a store in the source data, so — same as the
// Excel-based importer — each purchase is linked to whichever store the
// customer has the most other (non-subscription) transactions at. Run this
// *after* importing any booking data covering the same period, so the
// store-resolution has the fullest possible history to work from.
//
// Every row carries 支払いID as external_id, so re-running this on an export
// that overlaps a *previous run of this script* is safe (INSERT OR IGNORE on
// that unique key). It is NOT safe against re-covering ground already in the
// bundled historical subscriptions CSV (which has no external_id), so this
// only imports rows dated after the latest 定期クーポン purchase already in
// transactions — pass --since=YYYY-MM-DD to override.
//
// Usage: node src/importRawSubscriptions.js <path-to-export.csv> [--since=YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { SUBSCRIPTION_STATUS } from "./config.js";
import { canonicalizeUserName, resolveStoreForUser } from "./importHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, 0, NULL, @weekday, @channel, @status, @external_id)
`);

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  if (!inputPath) {
    console.error("Usage: node src/importRawSubscriptions.js <path-to-export.csv> [--since=YYYY-MM-DD]");
    process.exit(1);
  }

  const existingMaxDate = db.prepare("SELECT MAX(date) AS d FROM transactions WHERE status = ?").get(SUBSCRIPTION_STATUS).d;
  const since = sinceArg || existingMaxDate || "0000-00-00";
  console.log(`Only importing rows dated after ${since}${sinceArg ? " (--since)" : " (latest existing subscription date)"}.`);

  const csvText = fs.readFileSync(inputPath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const outRows = [];
  let inserted = 0;
  let ignoredDuplicate = 0;
  let skippedAlreadyCovered = 0;
  const unresolved = [];

  db.exec("BEGIN");
  try {
    for (const raw of parsed.data) {
      const date = String(raw["購入日時"] || "").slice(0, 10);
      const revenueRaw = raw["利益"] !== "" && raw["利益"] != null ? raw["利益"] : raw["金額"];
      const revenue = Number(String(revenueRaw).replace(/,/g, ""));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(revenue)) continue;
      if (date <= since) {
        skippedAlreadyCovered++;
        continue;
      }

      const userName = canonicalizeUserName(raw["顧客名"]);
      const store = resolveStoreForUser(userName);
      if (!store) {
        unresolved.push({ name: userName, date, revenue });
        continue;
      }

      const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
      const row = {
        date,
        store,
        user_name: userName,
        revenue,
        weekday,
        channel: SUBSCRIPTION_STATUS,
        status: SUBSCRIPTION_STATUS,
        external_id: raw["支払いID"] || null,
      };

      const result = insertStmt.run(row);
      if (result.changes > 0) {
        inserted++;
        outRows.push(row);
      } else {
        ignoredDuplicate++;
      }
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  console.log({ inserted, ignoredDuplicate, skippedAlreadyCovered, unresolved: unresolved.length });
  if (unresolved.length > 0) {
    console.warn("Could not link to a store (no matching usage history yet) — not imported:");
    console.warn(unresolved);
  }

  if (outRows.length > 0) {
    const outPath = path.join(DATA_DIR, `luna_subscriptions_${outRows[0].date.slice(0, 7)}_raw_imports.csv`);
    const header = "date,store,user,revenue,weekday,external_id";
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    const lines = outRows.map((r) => [r.date, r.store, esc(r.user_name), r.revenue, r.weekday, r.external_id].join(","));
    const isNew = !fs.existsSync(outPath);
    fs.appendFileSync(outPath, (isNew ? header + "\n" : "") + lines.join("\n") + "\n", "utf-8");
    console.log(`Appended ${outRows.length} rows to ${path.basename(outPath)}`);
  }
  console.warn(
    "Rows are already live in server/luna.db. The generated CSV just keeps the import reproducible for a future from-scratch reseed."
  );
}

main();
