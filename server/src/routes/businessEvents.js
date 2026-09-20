import { Router } from "express";
import { listBusinessEvents, createBusinessEvent, updateBusinessEvent, deleteBusinessEvent } from "../businessEventsService.js";

const router = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDates(res, startDate, endDate) {
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    res.status(400).json({ error: "startDate, endDate は YYYY-MM-DD で指定してください" });
    return false;
  }
  if (endDate < startDate) {
    res.status(400).json({ error: "endDate は startDate 以降にしてください" });
    return false;
  }
  return true;
}

router.get("/business-events", (req, res) => {
  res.json({ events: listBusinessEvents() });
});

router.post("/business-events", (req, res) => {
  const { startDate, endDate, stores, note } = req.body ?? {};
  if (!validateDates(res, startDate, endDate)) return;
  if (!String(note ?? "").trim()) {
    return res.status(400).json({ error: "note は必須です" });
  }
  res.status(201).json({ event: createBusinessEvent({ startDate, endDate, stores, note }) });
});

router.put("/business-events/:id", (req, res) => {
  const { startDate, endDate, stores, note } = req.body ?? {};
  if (startDate !== undefined || endDate !== undefined) {
    const existing = listBusinessEvents().find((e) => e.id === Number(req.params.id));
    const nextStart = startDate !== undefined ? startDate : existing?.start_date;
    const nextEnd = endDate !== undefined ? endDate : existing?.end_date;
    if (!validateDates(res, nextStart, nextEnd)) return;
  }
  const event = updateBusinessEvent(Number(req.params.id), { startDate, endDate, stores, note });
  if (!event) return res.status(404).json({ error: "見つかりませんでした。" });
  res.json({ event });
});

router.delete("/business-events/:id", (req, res) => {
  deleteBusinessEvent(Number(req.params.id));
  res.json({ ok: true });
});

export default router;
