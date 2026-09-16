import { Router } from "express";
import { searchTransactions } from "../transactionsService.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/transactions", (req, res) => {
  const { start, end, limit } = req.query;
  if (start && !DATE_RE.test(start)) return res.status(400).json({ error: "start must be YYYY-MM-DD" });
  if (end && !DATE_RE.test(end)) return res.status(400).json({ error: "end must be YYYY-MM-DD" });
  res.json(searchTransactions({ start, end, limit }));
});

export default router;
