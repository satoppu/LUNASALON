import { Router } from "express";

const router = Router();

router.get("/template", (req, res) => {
  const header = "日付,店舗,利用者,売上,利用時間,hour,weekday,channel\n";
  const example =
    "2026-09-01,Bellezza,田中セラピー,7350,7,10,火,自社サイト\n" +
    "2026-09-01,Forest,山本エステ,4900,5,14,火,Instabase\n" +
    "2026-09-01,Asteria,高橋整体,6120,6,18,火,スペースマーケット\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="luna_dashboard_template.csv"');
  res.send("﻿" + header + example);
});

export default router;
