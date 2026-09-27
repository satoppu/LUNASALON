import { Router } from "express";
import {
  listExpenses,
  getExpenseFilters,
  createExpense,
  updateExpense,
  deleteExpense,
  getMonthlyPnL,
  getCategoryBreakdown,
} from "../expensesService.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/expenses/filters", (req, res) => {
  res.json(getExpenseFilters());
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

export default router;
