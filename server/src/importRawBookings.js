// Imports a raw booking export straight from the reservation platform
// (columns: スペース名,顧客名,HN,決済元金,割引金額,返金額,利益確定後返金,利益,
// 使用クーポン,決済方法,状態,決済日時,決済日時（データ入力用）,利用日時,
// 売り上げ確定日時,決済ID) — a different shape from both the dashboard's own
// CSV template and the historical Excel "データ" sheet.
//
// Business-rule mapping:
// - 状態 "未確定" (future, not yet happened) is skipped — spec 4.4 excludes
//   unconfirmed future reservations, and these will show up as 利用済み or a
//   cancellation in a later export once resolved.
// - 状態 "利用済み" -> our "利用済み"; hours_used is computed from 利用日時's
//   time range, revenue from 利益 (the already-discount/coupon-netted amount,
//   NOT 決済元金 — a coupon-paid visit nets to 0 here because its revenue was
//   already counted when the coupon itself was purchased).
// - 状態 "キャンセル(顧客)" -> "キャンセル(返金あり)" when 利益 > 0 (a
//   cancellation fee was kept) else "キャンセル(顧客)"; spec 4.2/4.3.
// - 状態 "キャンセル(オーナー)" (owner-side cancellation) is kept as its own
//   status label for transparency; it isn't in REVENUE_STATUSES/
//   HOURS_USED_STATUSES so it's zero-weighted the same as a customer cancel.
//
// Every row carries 決済ID as external_id, so re-running this on an export
// that overlaps a *previous run of this script* is safe (INSERT OR IGNORE on
// that unique key). It is NOT safe against re-covering ground already in the
// bundled historical CSV, though: that data has no external_id (it predates
// this import path), so the same real booking would insert again as a
// distinct row and double-count revenue/hours. To guard against that, this
// only imports rows whose usage date is after the latest date already in
// transactions — pass --since=YYYY-MM-DD to override (e.g. for a first run
// against an export whose period doesn't butt up against existing data).
//
// Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import db from "./db.js";
import { canonicalizeUserName } from "./importHelpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

const WEEKDAY_FROM_JS_DOW = ["日", "月", "火", "水", "木", "金", "土"];
const STORE_PREFIX = "レンタルサロン ";
const CHANNEL = "自社サイト"; // this export is 自社サイト-only bookings, per the source.

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO transactions (date, store, user_name, revenue, hours_used, start_hour, weekday, channel, status, external_id)
  VALUES (@date, @store, @user_name, @revenue, @hours_used, @start_hour, @weekday, @channel, @status, @external_id)
`);

function parseUsage(raw) {
  const m = String(raw).match(/^(\d{2})\/(\d{2})\s*\(.\)\s*(\d{1,2}):(\d{2})[〜~](\d{1,2}):(\d{2})/u);
  if (!m) return null;
  return {
    month: Number(m[1]),
    day: Number(m[2]),
    startHour: Number(m[3]),
    startMin: Number(m[4]),
    endHour: Number(m[5]),
    endMin: Number(m[6]),
  };
}

// Usage normally happens on/after the payment date; if the usage month is
// earlier than the payment month, the booking crosses a New Year boundary.
function resolveYear(usageMonth, paymentISODate) {
  const paymentYear = Number(paymentISODate.slice(0, 4));
  const paymentMonth = Number(paymentISODate.slice(5, 7));
  return usageMonth < paymentMonth ? paymentYear + 1 : paymentYear;
}

function mapStatus(rawStatus, revenue) {
  if (rawStatus === "利用済み") return "利用済み";
  if (rawStatus === "キャンセル(顧客)") return revenue > 0 ? "キャンセル(返金あり)" : "キャンセル(顧客)";
  if (rawStatus === "キャンセル(オーナー)") return "キャンセル(オーナー)";
  return null; // 未確定 or an unrecognized status
}

function main() {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const sinceArg = args.find((a) => a.startsWith("--since="))?.slice("--since=".length);
  if (!inputPath) {
    console.error("Usage: node src/importRawBookings.js <path-to-export.csv> [--since=YYYY-MM-DD]");
    process.exit(1);
  }

  const existingMaxDate = db.prepare("SELECT MAX(date) AS d FROM transactions").get().d;
  const since = sinceArg || existingMaxDate;
  console.log(`Only importing rows with usage date after ${since}${sinceArg ? " (--since)" : " (latest existing date)"}.`);

  const csvText = fs.readFileSync(inputPath, "utf-8").replace(/^﻿/, "");
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

  const outRows = [];
  let inserted = 0;
  let ignoredDuplicate = 0;
  let skippedPending = 0;
  let skippedUnparseable = 0;
  let skippedAlreadyCovered = 0;

  db.exec("BEGIN");
  try {
    for (const raw of parsed.data) {
      const rawStatus = raw["状態"];
      if (rawStatus === "未確定") {
        skippedPending++;
        continue;
      }

      const revenue = Number(raw["利益"]) || 0;
      const status = mapStatus(rawStatus, revenue);
      const usage = parseUsage(raw["利用日時"]);
      const paymentISO = raw["決済日時（データ入力用）"];
      if (!status || !usage || !paymentISO) {
        skippedUnparseable++;
        continue;
      }

      const year = resolveYear(usage.month, paymentISO);
      const date = `${year}-${String(usage.month).padStart(2, "0")}-${String(usage.day).padStart(2, "0")}`;
      if (date <= since) {
        skippedAlreadyCovered++;
        continue;
      }
      const weekday = WEEKDAY_FROM_JS_DOW[new Date(date).getDay()];
      const hoursUsed =
        status === "利用済み"
          ? (usage.endHour * 60 + usage.endMin - (usage.startHour * 60 + usage.startMin)) / 60
          : 0;

      const row = {
        date,
        store: String(raw["スペース名"]).replace(STORE_PREFIX, "").trim(),
        user_name: canonicalizeUserName(raw["顧客名"]),
        revenue,
        hours_used: hoursUsed,
        start_hour: usage.startHour,
        weekday,
        channel: CHANNEL,
        status,
        external_id: raw["決済ID"] || null,
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

  console.log({ inserted, ignoredDuplicate, skippedPending, skippedUnparseable, skippedAlreadyCovered });

  if (outRows.length > 0) {
    const outPath = path.join(DATA_DIR, `luna_usage_${outRows[0].date.slice(0, 7)}_raw_imports.csv`);
    const header = "date,store,user,revenue,hoursUsed,hour,weekday,channel,status,external_id";
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    const lines = outRows.map((r) =>
      [r.date, r.store, esc(r.user_name), r.revenue, r.hours_used, r.start_hour, r.weekday, r.channel, r.status, r.external_id].join(",")
    );
    const isNew = !fs.existsSync(outPath);
    fs.appendFileSync(outPath, (isNew ? header + "\n" : "") + lines.join("\n") + "\n", "utf-8");
    console.log(`Appended ${outRows.length} rows to ${path.basename(outPath)}`);
  }
  console.warn(
    "Rows are already live in server/luna.db. The generated CSV just keeps the import reproducible for a future from-scratch reseed."
  );
}

main();
