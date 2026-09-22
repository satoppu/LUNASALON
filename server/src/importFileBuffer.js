// Shared entry point for "a file came in, figure out its format and import
// it" — used by the manual upload route (importRoute.js) and by the
// unattended よやクルPro auto-fetch script (scripts/autoFetchImport.js), so
// an automated download goes through exactly the same zip/xlsx/csv
// detection and business rules as a person clicking "インポート" by hand.
import AdmZip from "adm-zip";
import XLSX from "xlsx";
import { importCsv, importParsedRows } from "./importService.js";
import { detectRawFormat } from "./rawImportMappers.js";

export function isZip(filename, mimetype) {
  return (
    filename?.toLowerCase().endsWith(".zip") || mimetype === "application/zip" || mimetype === "application/x-zip-compressed"
  );
}

export function isXlsx(filename, mimetype) {
  return (
    /\.xlsx?$/i.test(filename || "") ||
    mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimetype === "application/vnd.ms-excel"
  );
}

// A workbook can carry multiple sheets (e.g. スペースマーケット's monthly
// export bundles a "統合売上明細" sheet alongside a "集計" summary sheet) —
// use whichever sheet's header row actually matches one of the raw export
// shapes, skipping any that don't (a summary sheet just won't match).
function importXlsxBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: "" });
    if (rows.length === 0) continue;
    if (detectRawFormat(Object.keys(rows[0]))) return importParsedRows(rows);
  }
  return { error: "対応する形式のシートが見つかりませんでした。" };
}

// Combines each CSV's importCsv() result (e.g. the 予約 and 有料クーポン
// exports bundled in the 自社サイトの zip download) into one summary by
// summing the numeric fields every format can produce.
const NUMERIC_RESULT_KEYS = [
  "inserted",
  "updated",
  "duplicates",
  "skipped",
  "skippedUnparseable",
  "skippedAlreadyCovered",
  "unresolvedOrBad",
  "claimed",
  "claimSkippedAmbiguous",
  "claimSkippedConflict",
];
function mergeResults(results) {
  const merged = { format: results.map((r) => r.format).join("+"), error: null };
  for (const key of NUMERIC_RESULT_KEYS) {
    merged[key] = results.reduce((s, r) => s + (r[key] || 0), 0);
  }
  return merged;
}

/** @param {Buffer} buffer @param {string} filename @param {string} [mimetype] */
export function importFileBuffer(buffer, filename, mimetype) {
  if (isXlsx(filename, mimetype)) return importXlsxBuffer(buffer);

  if (isZip(filename, mimetype)) {
    const zip = new AdmZip(buffer);
    const csvEntries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".csv"));
    if (csvEntries.length === 0) {
      return { error: "zip内にCSVファイルが見つかりませんでした。" };
    }
    const results = csvEntries.map((entry) => importCsv(entry.getData().toString("utf-8")));
    const failed = results.find((r) => r.error);
    if (failed) return failed;
    return mergeResults(results);
  }

  return importCsv(buffer.toString("utf-8"));
}
