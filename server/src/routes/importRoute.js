import { Router } from "express";
import multer from "multer";
import { importFileBuffer } from "../importFileBuffer.js";

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
    const result = importFileBuffer(req.file.buffer, req.file.originalname, req.file.mimetype);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "インポート中にエラーが発生しました。", detail: err.message });
  }
});

export default router;
