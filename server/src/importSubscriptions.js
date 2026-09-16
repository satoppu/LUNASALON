// One-off maintenance tool: regenerates data/luna_subscriptions_2023-2026.csv
// from a raw reservation-system Excel export (the "データ" sheet, spec 3.1).
//
// 定期クーポン (subscription) rows aren't tied to a store in the source data
// (spec 4.2/4.6), so this resolves each subscriber's store as whichever store
// they have the most non-subscription transactions at — using the *current*
// transactions table, so run this after the regular usage CSV has already
// been imported/seeded. Falls back to matching the name with any trailing
// "(...)"/"（...）" annotation stripped (e.g. "山田太郎(テスト)" -> "山田太郎")
// before giving up on a row.
//
// Usage: node src/importSubscriptions.js <path-to-raw-export.xlsx>
// Requires the `xlsx` package (devDependency only — not needed at runtime).
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import db from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "..", "data", "luna_subscriptions_2023-2026.csv");

const SUBSCRIPTION_STATUS_LABEL = "定期クーポン";

function resolveStore(name) {
  const stmt = db.prepare(
    "SELECT store, COUNT(*) c FROM transactions WHERE user_name = ? GROUP BY store ORDER BY c DESC LIMIT 1"
  );
  let row = stmt.get(name);
  if (row) return row.store;
  const normalized = name.replace(/[(（].*$/, "").trim();
  if (normalized !== name) {
    row = stmt.get(normalized);
    if (row) return row.store;
  }
  return null;
}

function toISODate(s) {
  const m = String(s).trim().match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node src/importSubscriptions.js <path-to-raw-export.xlsx>");
    process.exit(1);
  }

  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets["データ"];
  if (!ws) {
    console.error('Sheet "データ" not found in workbook.');
    process.exit(1);
  }
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  const header = rows[0];
  const idx = {};
  header.forEach((h, i) => { if (h) idx[h] = i; });

  const subs = rows.slice(1).filter((r) => r[idx["ステータス"]] === SUBSCRIPTION_STATUS_LABEL);

  const out = ["date,store,user,revenue,weekday"];
  const unresolved = [];

  for (const r of subs) {
    const name = String(r[idx["氏名"]]).trim();
    const store = resolveStore(name);
    const date = toISODate(r[idx["開始日付"]]);
    const revenue = Number(String(r[idx["金額"]]).replace(/,/g, "").trim());
    const weekday = r[idx["曜日"]];
    if (!store || !date || Number.isNaN(revenue)) {
      unresolved.push({ name, date, revenue, store });
      continue;
    }
    const esc = (v) => (String(v).includes(",") ? `"${v}"` : v);
    out.push([date, store, esc(name), revenue, weekday].join(","));
  }

  fs.writeFileSync(OUT_PATH, out.join("\n") + "\n", "utf-8");
  console.log(`Resolved ${out.length - 1}/${subs.length} subscription rows -> ${path.basename(OUT_PATH)}`);
  if (unresolved.length > 0) {
    console.warn(`${unresolved.length} row(s) could not be linked to a store (no matching usage history):`);
    console.warn(unresolved);
    console.warn("These were NOT written to the CSV — resolve manually and re-run, or edit the CSV directly.");
  }
  console.warn("Remember to delete server/luna.db and re-seed to pick up the regenerated file.");
}

main();
