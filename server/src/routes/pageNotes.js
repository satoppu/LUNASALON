import { Router } from "express";
import { isValidPageKey, getPageNote, savePageNote } from "../pageNotesService.js";

const router = Router();

router.get("/page-notes/:pageKey", (req, res) => {
  const { pageKey } = req.params;
  if (!isValidPageKey(pageKey)) return res.status(400).json({ error: "不明なページです。" });
  res.json(getPageNote(pageKey));
});

router.put("/page-notes/:pageKey", (req, res) => {
  const { pageKey } = req.params;
  if (!isValidPageKey(pageKey)) return res.status(400).json({ error: "不明なページです。" });
  const { reflection, todo } = req.body || {};
  res.json(savePageNote(pageKey, { reflection, todo }));
});

export default router;
