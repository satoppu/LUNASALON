import { Router } from "express";
import { getDashboard, getAvailableYears, getYoyByStore } from "../dashboardService.js";
import { getNewBookingsDaily } from "../newBookingsDaily.js";

const router = Router();

router.get("/dashboard/new-bookings-daily", (req, res) => {
  res.json({ days: getNewBookingsDaily() });
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
