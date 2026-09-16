import { Router } from "express";
import Papa from "papaparse";
import { searchTransactions, exportTransactions, getTransactionFilters } from "../transactionsService.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/transactions/filters", (req, res) => {
  res.json(getTransactionFilters());
});

router.get("/transactions", (req, res) => {
  const { start, end, store, status, user, limit, offset, sort } = req.query;
  if (start && !DATE_RE.test(start)) return res.status(400).json({ error: "start must be YYYY-MM-DD" });
  if (end && !DATE_RE.test(end)) return res.status(400).json({ error: "end must be YYYY-MM-DD" });
  if (sort && sort !== "asc" && sort !== "desc") return res.status(400).json({ error: "sort must be asc or desc" });
  res.json(searchTransactions({ start, end, store, status, user, limit, offset, sort }));
});

router.get("/transactions/export", (req, res) => {
  const { start, end, store, status, user, sort } = req.query;
  if (start && !DATE_RE.test(start)) return res.status(400).json({ error: "start must be YYYY-MM-DD" });
  if (end && !DATE_RE.test(end)) return res.status(400).json({ error: "end must be YYYY-MM-DD" });
  if (sort && sort !== "asc" && sort !== "desc") return res.status(400).json({ error: "sort must be asc or desc" });

  const rows = exportTransactions({ start, end, store, status, user, sort });
  const csv = Papa.unparse(
    rows.map((r) => ({
      日付: r.date,
      店舗: r.store,
      利用者: r.user_name,
      導線: r.channel,
      状態: r.status,
      売上: r.revenue,
      利用時間: r.hours_used,
    }))
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="luna_usage_history.csv"');
  res.send("﻿" + csv);
});

export default router;
