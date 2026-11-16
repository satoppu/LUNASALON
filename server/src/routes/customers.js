import { Router } from "express";
import { getCustomerAnalysis } from "../customerService.js";
import { listLineStats } from "../lineInsight.js";
import { listLineFollowerEventsWithCustomers } from "../lineFollowers.js";

const router = Router();

router.get("/customers", (req, res) => {
  res.json(getCustomerAnalysis());
});

// LINE公式アカウントの友だち数の推移(毎朝の自動取り込みで記録した分)。
router.get("/line-stats", (req, res) => {
  res.json({ stats: listLineStats() });
});

// LINEのブロック・友だち追加の履歴(いつ・誰が)。照合できたお客様の名前つき。
router.get("/line-follower-events", (req, res) => {
  res.json({ events: listLineFollowerEventsWithCustomers() });
});

export default router;
