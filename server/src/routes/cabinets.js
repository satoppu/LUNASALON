import { Router } from "express";
import db from "../db.js";
import {
  listCabinetsWithRecentUsage,
  createCabinet,
  updateCabinet,
  deleteCabinet,
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  buildCouponPurchaseList,
} from "../cabinetsService.js";

const router = Router();

// SQLiteのUNIQUE制約違反(店舗+番号の重複、クーポンIDの重複)を、生のエラー
// ではなく分かりやすい400として返す。node:sqliteはbetter-sqlite3と違い
// err.code="ERR_SQLITE_ERROR"で、実際のSQLiteエラー名はerr.errstrに入る。
function runOrConflict(res, fn, conflictMessage) {
  try {
    res.json(fn());
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: "見つかりませんでした。" });
    if (err.code === "ERR_SQLITE_ERROR" && /constraint/i.test(err.errstr || err.message || "")) {
      return res.status(400).json({ error: conflictMessage });
    }
    throw err;
  }
}

router.get("/cabinets", (req, res) => {
  res.json({ cabinets: listCabinetsWithRecentUsage() });
});

router.post("/cabinets", (req, res) => {
  const { store, slotLabel, userName } = req.body ?? {};
  if (!store || !String(slotLabel ?? "").trim()) {
    return res.status(400).json({ error: "store, slotLabel は必須です" });
  }
  runOrConflict(
    res,
    () => ({ cabinet: createCabinet({ store, slotLabel: String(slotLabel).trim(), userName }) }),
    "この店舗にはすでに同じ番号のキャビネットがあります。"
  );
});

router.put("/cabinets/:id", (req, res) => {
  const { store, slotLabel, userName } = req.body ?? {};
  runOrConflict(
    res,
    () => {
      const cabinet = updateCabinet(Number(req.params.id), {
        store,
        slotLabel: slotLabel !== undefined ? String(slotLabel).trim() : undefined,
        userName,
      });
      if (!cabinet) throw Object.assign(new Error("not found"), { status: 404 });
      return { cabinet };
    },
    "この店舗にはすでに同じ番号のキャビネットがあります。"
  );
});

router.delete("/cabinets/:id", (req, res) => {
  deleteCabinet(Number(req.params.id));
  res.json({ ok: true });
});

router.get("/coupons", (req, res) => {
  res.json({ coupons: listCoupons() });
});

// 顧客分析とは別の、参照専用の一覧ページ(ReferencePage.jsx)向け。
router.get("/coupons/purchases", (req, res) => {
  const allRows = db.prepare(`SELECT date, user_name, status FROM transactions`).all();
  res.json({ purchases: buildCouponPurchaseList(allRows) });
});

router.post("/coupons", (req, res) => {
  const { couponId, userName } = req.body ?? {};
  if (!String(couponId ?? "").trim()) {
    return res.status(400).json({ error: "couponId は必須です" });
  }
  runOrConflict(
    res,
    () => ({ coupon: createCoupon({ couponId: String(couponId).trim(), userName }) }),
    "このクーポンIDはすでに使われています。"
  );
});

router.put("/coupons/:id", (req, res) => {
  const { couponId, userName } = req.body ?? {};
  runOrConflict(
    res,
    () => {
      const coupon = updateCoupon(Number(req.params.id), {
        couponId: couponId !== undefined ? String(couponId).trim() : undefined,
        userName,
      });
      if (!coupon) throw Object.assign(new Error("not found"), { status: 404 });
      return { coupon };
    },
    "このクーポンIDはすでに使われています。"
  );
});

router.delete("/coupons/:id", (req, res) => {
  deleteCoupon(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
