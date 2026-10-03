import { Router } from "express";
import { getCustomerAnalysis } from "../customerService.js";

const router = Router();

router.get("/customers", (req, res) => {
  res.json(getCustomerAnalysis());
});

export default router;
