import { Router } from "express";
import multer from "multer";
import { importCsv, backfillBookingDate } from "../importService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.post("/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSVファイルを file フィールドで送信してください。" });
  }
  try {
    const csvText = req.file.buffer.toString("utf-8");
    const result = importCsv(csvText);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "インポート中にエラーが発生しました。", detail: err.message });
  }
});

router.post("/import/backfill-booking-date", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "CSVファイルを file フィールドで送信してください。" });
  }
  try {
    const csvText = req.file.buffer.toString("utf-8");
    const result = backfillBookingDate(csvText);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "反映中にエラーが発生しました。", detail: err.message });
  }
});

export default router;
