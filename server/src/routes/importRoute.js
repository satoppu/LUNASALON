import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { importCsv } from "../importService.js";

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

// Combines each CSV's importCsv() result (e.g. the 予約 and 有料クーポン
// exports bundled in the 自社サイト's zip download) into one summary by
// summing the numeric fields every format can produce.
const NUMERIC_RESULT_KEYS = ["inserted", "updated", "duplicates", "skipped", "skippedUnparseable", "skippedAlreadyCovered", "unresolvedOrBad"];
function mergeResults(results) {
  const merged = { format: results.map((r) => r.format).join("+"), error: null };
  for (const key of NUMERIC_RESULT_KEYS) {
    const sum = results.reduce((s, r) => s + (r[key] || 0), 0);
    if (sum > 0) merged[key] = sum;
  }
  return merged;
}

router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSVファイルを file フィールドで送信してください。" });
  }
  try {
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
