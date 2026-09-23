import { Router } from "express";
import { listStoreSettings, updateStoreSetting } from "../storeSettingsService.js";

const router = Router();

router.get("/store-settings", (req, res) => {
  res.json({ stores: listStoreSettings() });
});

router.put("/store-settings/:store", (req, res) => {
  const { store } = req.params;
  const { area, color, openDate, operatingHoursPerDay } = req.body ?? {};

  if (openDate !== undefined && openDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(openDate)) {
    return res.status(400).json({ error: "openDate must be YYYY-MM-DD or null" });
  }
  if (operatingHoursPerDay !== undefined) {
    const n = Number(operatingHoursPerDay);
    if (!Number.isFinite(n) || n <= 0 || n > 24) {
      return res.status(400).json({ error: "operatingHoursPerDay must be a number between 0 and 24" });
    }
  }

  const updated = updateStoreSetting(store, {
    area,
    color,
    openDate: openDate === undefined ? undefined : openDate,
    operatingHoursPerDay: operatingHoursPerDay === undefined ? undefined : Number(operatingHoursPerDay),
  });
  res.json({ store: updated });
});

export default router;
