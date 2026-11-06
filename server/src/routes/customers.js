import { Router } from "express";
import { getCustomerAnalysis } from "../customerService.js";
import { listLineStats } from "../lineInsight.js";

const router = Router();

router.get("/customers", (req, res) => {
  res.json(getCustomerAnalysis());
});

// LINE公式アカウントの友だち数の推移(毎朝の自動取り込みで記録した分)。
router.get("/line-stats", (req, res) => {
  res.json({ stats: listLineStats() });
});

export default router;
