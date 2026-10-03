import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
  listExpenses,
  getExpenseFilters,
  createExpense,
  updateExpense,
  deleteExpense,
  getMonthlyPnL,
  getCategoryBreakdown,
  getExpense,
  saveExpenseReceipt,
  removeExpenseReceipt,
  RECEIPTS_DIR,
} from "../expensesService.js";
import { isReceiptScanEnabled, isScannableType, scanReceipt } from "../receiptScanService.js";

const router = Router();

const RECEIPT_EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/expenses/filters", (req, res) => {
  res.json({ ...getExpenseFilters(), receiptScanEnabled: isReceiptScanEnabled() });
});

router.get("/expenses", (req, res) => {
  const { start, end, category, store, limit, offset } = req.query;
  if (start && !DATE_RE.test(start)) return res.status(400).json({ error: "start must be YYYY-MM-DD" });
  if (end && !DATE_RE.test(end)) return res.status(400).json({ error: "end must be YYYY-MM-DD" });
  res.json(
    listExpenses({
      start,
      end,
      category,
      store,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    })
  );
});

router.get("/expenses/summary", (req, res) => {
  const year = Number(req.query.year);
  if (!year) return res.status(400).json({ error: "year is required" });
  res.json({ year, months: getMonthlyPnL(year), categories: getCategoryBreakdown(year) });
});

router.post("/expenses", (req, res) => {
  const { date, category, store, amount, description } = req.body ?? {};
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  if (!category) return res.status(400).json({ error: "category is required" });
  if (!Number.isFinite(Number(amount))) return res.status(400).json({ error: "amount must be a number" });
  res.json({ expense: createExpense({ date, category, store, amount: Number(amount), description }) });
});

router.put("/expenses/:id", (req, res) => {
  const { date, category, store, amount, description } = req.body ?? {};
  if (date && !DATE_RE.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  const expense = updateExpense(Number(req.params.id), {
    date,
    category,
    store,
    amount: amount !== undefined ? Number(amount) : undefined,
    description,
  });
  if (!expense) return res.status(404).json({ error: "見つかりませんでした。" });
  res.json({ expense });
});

router.delete("/expenses/:id", (req, res) => {
  deleteExpense(Number(req.params.id));
  res.json({ ok: true });
});

function receiptFileMiddleware(req, res, next) {
  receiptUpload.single("file")(req, res, (err) => {
    if (!err) return next();
    const message = err.code === "LIMIT_FILE_SIZE" ? "ファイルが大きすぎます(15MBまで)。" : err.message;
    res.status(400).json({ error: message });
  });
}

router.post("/expenses/receipt-scan", receiptFileMiddleware, async (req, res) => {
  if (!isReceiptScanEnabled()) {
    return res.status(503).json({ error: "自動読み取りが未設定です(サーバーの ANTHROPIC_API_KEY)。" });
  }
  if (!req.file) return res.status(400).json({ error: "ファイルが選択されていません。" });
  if (!isScannableType(req.file.mimetype)) {
    return res.status(400).json({ error: "この形式は自動読み取りできません(JPEG/PNG/WebP/PDF)。" });
  }
  try {
    res.json({ result: await scanReceipt(req.file.buffer, req.file.mimetype) });
  } catch (err) {
    console.error("receipt scan failed:", err);
    res.status(502).json({ error: `自動読み取りに失敗しました: ${err.message}` });
  }
});

router.post("/expenses/:id/receipt", receiptFileMiddleware, (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ファイルが選択されていません。" });
  const ext = RECEIPT_EXT_BY_TYPE[req.file.mimetype];
  if (!ext) return res.status(400).json({ error: "画像(JPEG/PNG/WebP/HEIC)かPDFを選んでください。" });
  const expense = saveExpenseReceipt(Number(req.params.id), req.file.buffer, ext);
  if (!expense) return res.status(404).json({ error: "見つかりませんでした。" });
  res.json({ expense });
});

router.get("/expenses/:id/receipt", (req, res) => {
  const expense = getExpense(Number(req.params.id));
  if (!expense?.receipt_file) return res.status(404).json({ error: "レシートがありません。" });
  res.sendFile(path.join(RECEIPTS_DIR, expense.receipt_file));
});

router.delete("/expenses/:id/receipt", (req, res) => {
  const expense = removeExpenseReceipt(Number(req.params.id));
  if (!expense) return res.status(404).json({ error: "見つかりませんでした。" });
  res.json({ expense });
});

export default router;
