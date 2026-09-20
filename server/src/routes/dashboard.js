import { Router } from "express";
import { getDashboard, getAvailableYears, getYoyByStore } from "../dashboardService.js";
import { getNewBookingsDaily, getBookingsForDate } from "../newBookingsDaily.js";

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get("/dashboard/new-bookings-daily", (req, res) => {
  let offset = 0;
  if (req.query.offset !== undefined) {
    offset = Number(req.query.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({ error: "offset must be a non-negative integer" });
    }
  }
  res.json({ days: getNewBookingsDaily(offset) });
});

router.get("/dashboard/new-bookings-daily/detail", (req, res) => {
  const { date } = req.query;
  if (!date || !DATE_RE.test(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  res.json({ rows: getBookingsForDate(date) });
});

router.get("/years", (req, res) => {
  res.json({ years: getAvailableYears() });
});

router.get("/revenue/yoy-by-store", (req, res) => {
  const year = Number(req.query.year);
  if (!Number.isInteger(year)) {
    return res.status(400).json({ error: "year must be an integer" });
  }
  let month;
  if (req.query.month !== undefined) {
    month = Number(req.query.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "month must be an integer between 1 and 12" });
    }
  }
  res.json({ yoyByStore: getYoyByStore(year, month) });
});

router.get("/dashboard", (req, res) => {
  if (req.query.year === undefined) return res.json(getDashboard(undefined));
  const requestedYear = Number(req.query.year);
  if (!Number.isInteger(requestedYear)) {
    return res.status(400).json({ error: "year must be an integer" });
  }
  res.json(getDashboard(requestedYear));
});

export default router;
