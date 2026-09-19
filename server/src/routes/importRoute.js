import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import XLSX from "xlsx";
import { importCsv, importParsedRows } from "../importService.js";
import { detectRawFormat } from "../rawImportMappers.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

function isZip(file) {
  return (
    file.originalname?.toLowerCase().endsWith(".zip") ||
    file.mimetype === "application/zip" ||
    file.mimetype === "application/x-zip-compressed"
  );
}

function isXlsx(file) {
  return (
    /\.xlsx?$/i.test(file.originalname || "") ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.mimetype === "application/vnd.ms-excel"
  );
}

// A workbook can carry multiple sheets (e.g. スペースマーケット's monthly
// export bundles a "統合売上明細" sheet alongside a "集計" summary sheet) —
// use whichever sheet's header row actually matches one of the raw export
// shapes, skipping any that don't (a summary sheet just won't match).
function importXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, defval: "" });
    if (rows.length === 0) continue;
    if (detectRawFormat(Object.keys(rows[0]))) return importParsedRows(rows);
  }
  return { error: "対応する形式のシートが見つかりませんでした。" };
}

// Combines each CSV's importCsv() result (e.g. the 予約 and 有料クーポン
// exports bundled in the 自社サイト's zip download) into one summary by
// summing the numeric fields every format can produce.
const NUMERIC_RESULT_KEYS = ["inserted", "updated", "duplicates", "skipped", "skippedUnparseable", "skippedAlreadyCovered", "unresolvedOrBad"];
function mergeResults(results) {
  const merged = { format: results.map((r) => r.format).join("+"), error: null };
  for (const key of NUMERIC_RESULT_KEYS) {
    merged[key] = results.reduce((s, r) => s + (r[key] || 0), 0);
  }
  return merged;
}

router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSVファイルを file フィールドで送信してください。" });
  }
  try {
    if (isXlsx(req.file)) {
      const result = importXlsx(req.file.buffer);
      if (result.error) return res.status(400).json(result);
      return res.json(result);
    }

    if (isZip(req.file)) {
      const zip = new AdmZip(req.file.buffer);
      const csvEntries = zip.getEntries().filter((e) => !e.isDirectory && e.entryName.toLowerCase().endsWith(".csv"));
      if (csvEntries.length === 0) {
        return res.status(400).json({ error: "zip内にCSVファイルが見つかりませんでした。" });
      }
      const results = csvEntries.map((entry) => importCsv(entry.getData().toString("utf-8")));
      const failed = results.find((r) => r.error);
      if (failed) return res.status(400).json(failed);
      return res.json(mergeResults(results));
    }

    const csvText = req.file.buffer.toString("utf-8");
    const result = importCsv(csvText);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "インポート中にエラーが発生しました。", detail: err.message });
  }
});

export default router;
