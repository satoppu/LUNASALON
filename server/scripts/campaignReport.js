// 曜日限定の割引(例: Asteria 平日割 = 火・金)の効果を、開始前と比べて確かめる。
// 対象の曜日とそれ以外の曜日それぞれについて、稼働率・件数・時間・売上・導線別の件数を
// 「開始前(直前の8週間)」と「開始後(開始日〜昨日)」で並べ、開始後の対象曜日の予約は
// 今後の予約(利用前)も含めて1件ずつ出す。
//
// ターミナルでは日本語が文字化けすることがあるため、--email を付けるとメールで送る。
// Usage:
//   node scripts/campaignReport.js                      # Asteria・火金・2026-10-14〜12-26 の既定値
//   node scripts/campaignReport.js --email
//   node scripts/campaignReport.js --store Asteria --weekdays 火,金 --start 2026-10-14 --end 2026-12-26
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { default: db } = await import("../src/db.js");
const { getTodayISO, HOURS_USED_STATUSES, PENDING_STATUS, WEEKDAY_FROM_JS_DOW, DEFAULT_OPERATING_HOURS_PER_DAY } = await import(
  "../src/config.js"
);

const args = process.argv.slice(2);
const argValue = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const store = argValue("--store", "Asteria");
const targetDays = new Set(argValue("--weekdays", "火,金").split(","));
const start = argValue("--start", "2026-10-14");
const end = argValue("--end", "2026-12-26");
const BASELINE_DAYS = 56;

const shiftDays = (iso, days) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
const weekdayOf = (iso) => WEEKDAY_FROM_JS_DOW[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";

const today = getTodayISO();
const yesterday = shiftDays(today, -1);
const afterTo = yesterday < end ? yesterday : end;
const before = { label: "開始前", from: shiftDays(start, -BASELINE_DAYS), to: shiftDays(start, -1) };
const after = { label: "開始後", from: start, to: afterTo };

const statuses = [...HOURS_USED_STATUSES];
const rowsBetween = (from, to) =>
  db
    .prepare(
      `SELECT date, start_hour, start_minute, hours_used, revenue, channel, status, user_name, booking_date FROM transactions
       WHERE store = ? AND date >= ? AND date <= ? AND hours_used > 0 AND status IN (${statuses.map(() => "?").join(",")})
       ORDER BY date, start_hour, start_minute`
    )
    .all(store, from, to, ...statuses);

function countDays(from, to, wanted) {
  let n = 0;
  for (let d = from; d <= to; d = shiftDays(d, 1)) if (wanted(weekdayOf(d))) n++;
  return n;
}

function summarize(period, isTarget) {
  const wanted = (wd) => targetDays.has(wd) === isTarget;
  const rows = period.from <= period.to ? rowsBetween(period.from, period.to).filter((r) => wanted(weekdayOf(r.date))) : [];
  const days = period.from <= period.to ? countDays(period.from, period.to, wanted) : 0;
  const hours = rows.reduce((s, r) => s + r.hours_used, 0);
  const byChannel = {};
  for (const r of rows) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
  return {
    days,
    count: rows.length,
    hours,
    revenue: rows.reduce((s, r) => s + r.revenue, 0),
    occupancy: days ? hours / (days * DEFAULT_OPERATING_HOURS_PER_DAY) : 0,
    perDay: days ? rows.length / days : 0,
    byChannel,
  };
}

function block(title, isTarget) {
  const a = summarize(before, isTarget);
  const b = summarize(after, isTarget);
  const channels = [...new Set([...Object.keys(a.byChannel), ...Object.keys(b.byChannel)])].sort();
  return [
    `■ ${title}`,
    `  対象日数　　 ${a.days}日 → ${b.days}日`,
    `  稼働率　　　 ${pct(a.occupancy)} → ${pct(b.occupancy)}`,
    `  1日あたり件数 ${a.perDay.toFixed(2)}件 → ${b.perDay.toFixed(2)}件`,
    `  件数・時間　 ${a.count}件 ${a.hours.toFixed(1)}h → ${b.count}件 ${b.hours.toFixed(1)}h`,
    `  売上　　　　 ${yen(a.revenue)} → ${yen(b.revenue)}`,
    ...channels.map((c) => `    ${c}: ${a.byChannel[c] ?? 0}件 → ${b.byChannel[c] ?? 0}件`),
  ].join("\n");
}

const targetLabel = [...targetDays].join("・");
const detail = rowsBetween(start, end)
  .filter((r) => targetDays.has(weekdayOf(r.date)))
  .map((r) => {
    const time = r.start_hour != null ? `${String(r.start_hour).padStart(2, "0")}:${String(r.start_minute ?? 0).padStart(2, "0")}〜` : "";
    const future = r.status === PENDING_STATUS ? "(利用前)" : "";
    const booked = r.booking_date ? ` 予約日${r.booking_date.slice(5).replace("-", "/")}` : "";
    return `  ${r.date.slice(5).replace("-", "/")}(${weekdayOf(r.date)}) ${time} ${r.hours_used}h ${r.channel} ${yen(r.revenue)}${future}${booked}`;
  });

const text = [
  `${store} の${targetLabel}の割引(${start}〜${end})の効果です。`,
  `開始前: ${before.from}〜${before.to}(直前の8週間) / 開始後: ${after.from}〜${after.to}(昨日まで)`,
  `稼働率 = 利用時間 ÷ (日数 × ${DEFAULT_OPERATING_HOURS_PER_DAY}時間)。キャンセルは含めません。`,
  "",
  block(`${targetLabel}(割引の対象)`, true),
  "",
  block(`${targetLabel}以外の曜日(比べる用)`, false),
  "",
  `■ 開始後の${targetLabel}の予約(今後の予約も含む) ${detail.length}件`,
  ...(detail.length ? detail : ["  なし"]),
].join("\n");

if (args.includes("--email")) {
  const { sendResultEmail } = await import("../src/notifyEmail.js");
  await sendResultEmail({ subject: `【LUNA】${store} ${targetLabel}割引の効果`, text });
  console.log("メールで送りました。");
} else {
  console.log(text);
}
