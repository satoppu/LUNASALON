import { Router } from "express";
import { getDashboard, getAvailableYears } from "../dashboardService.js";

const router = Router();

router.get("/years", (req, res) => {
  res.json({ years: getAvailableYears() });
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
