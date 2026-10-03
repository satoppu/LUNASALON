import { Router } from "express";
import {
  MANUAL_ENTRY_STATUSES,
  listManualSpaceMarketTransactions,
  createManualSpaceMarketTransaction,
  updateManualSpaceMarketTransaction,
  deleteManualSpaceMarketTransaction,
  listKnownUserNames,
} from "../manualTransactionsService.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function validatePayload(body) {
  const { date, store, userName, status, revenue, startTime, endTime, bookingDate } = body ?? {};
  if (!DATE_RE.test(date || "")) return "利用日はYYYY-MM-DD形式で入力してください。";
  if (!String(store || "").trim()) return "店舗は必須です。";
  if (!String(userName || "").trim()) return "利用者名は必須です。";
  if (!MANUAL_ENTRY_STATUSES.includes(status)) return "状態が不正です。";
  if (revenue === undefined || revenue === null || Number.isNaN(Number(revenue))) return "売上は数値で入力してください。";
  if (startTime && !TIME_RE.test(startTime)) return "開始時間の形式が不正です。";
  if (endTime && !TIME_RE.test(endTime)) return "終了時間の形式が不正です。";
  if (bookingDate && !DATE_RE.test(bookingDate)) return "予約日はYYYY-MM-DD形式で入力してください。";
  return null;
}

router.get("/manual-space-market", (req, res) => {
  res.json({ transactions: listManualSpaceMarketTransactions(), statuses: MANUAL_ENTRY_STATUSES });
});

router.get("/manual-space-market/user-names", (req, res) => {
  res.json({ userNames: listKnownUserNames() });
});

router.post("/manual-space-market", (req, res) => {
  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });
  const { date, store, userName, status, revenue, startTime, endTime, bookingDate } = req.body;
  const transaction = createManualSpaceMarketTransaction({
    date,
    store: store.trim(),
    userName: userName.trim(),
    status,
    revenue: Number(revenue),
    startTime: startTime || null,
    endTime: endTime || null,
    bookingDate: bookingDate || null,
  });
  res.json({ transaction });
});

router.put("/manual-space-market/:id", (req, res) => {
  const error = validatePayload(req.body);
  if (error) return res.status(400).json({ error });
  const { date, store, userName, status, revenue, startTime, endTime, bookingDate } = req.body;
  const transaction = updateManualSpaceMarketTransaction(Number(req.params.id), {
    date,
    store: store.trim(),
    userName: userName.trim(),
    status,
    revenue: Number(revenue),
    startTime: startTime || null,
    endTime: endTime || null,
    bookingDate: bookingDate || null,
  });
  if (!transaction) return res.status(404).json({ error: "見つかりませんでした。" });
  res.json({ transaction });
});

router.delete("/manual-space-market/:id", (req, res) => {
  deleteManualSpaceMarketTransaction(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
