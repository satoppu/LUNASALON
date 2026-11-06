// 経営の全体像を、直近の数か月について1通のメールにまとめる(ダッシュボードを開けない
// 相手と共有する用・月初の振り返り用)。
//   - 全体: 売上(利用・定額クーポン・キャンセル料)・経費・営業利益
//   - 店舗別: 売上・利用時間・稼働率・0円(クーポン等)利用の割合・店舗の経費・店舗の利益
//     (共通経費 = 店舗未指定の経費は、全体の行にだけ入れる)
//   - 導線別の利用件数と、初めて利用したお客様の数(導線別)
//   - 年初からの累計
// 当月は「今日までに入っている予約(利用前を含む)」の途中経過として出す。
//
// ターミナルでは日本語が文字化けすることがあるため、--email を付けるとメールで送る。
// Usage:
//   node scripts/overviewReport.js                 # 直近3か月+当月
//   node scripts/overviewReport.js --months 6 --email
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) process.loadEnvFile?.(envPath);

const { default: db } = await import("../src/db.js");
const { getTodayISO, HOURS_USED_STATUSES, SUBSCRIPTION_STATUS } = await import("../src/config.js");
const { effectiveRevenue } = await import("../src/aggregations.js");
const { getEffectiveOpenDates } = await import("../src/dashboardService.js");

const args = process.argv.slice(2);
const monthsBack = Number(args.includes("--months") ? args[args.indexOf("--months") + 1] : 3) || 3;

const today = getTodayISO();
const ym = (iso) => iso.slice(0, 7);
const addMonths = (yearMonth, n) => {
  const [y, m] = yearMonth.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};
const daysInMonth = (yearMonth) => {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
const label = (yearMonth) => `${Number(yearMonth.slice(5, 7))}月`;
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const pct = (n) => (n * 100).toFixed(1) + "%";

const currentMonth = ym(today);
const months = Array.from({ length: monthsBack + 1 }, (_, i) => addMonths(currentMonth, i - monthsBack));
const firstDay = `${months[0]}-01`;
const lastDay = `${currentMonth}-${String(daysInMonth(currentMonth)).padStart(2, "0")}`;

const stores = db.prepare(`SELECT store, operating_hours_per_day AS hpd FROM store_settings ORDER BY sort_order, store`).all();
const openDates = getEffectiveOpenDates();
const tx = db.prepare(`SELECT date, store, user_name, revenue, hours_used, status, channel FROM transactions WHERE date >= ? AND date <= ?`).all(firstDay, lastDay);
const expenses = db.prepare(`SELECT date, store, category, amount FROM expenses WHERE date >= ? AND date <= ?`).all(firstDay, lastDay);

/** その月に店舗が営業していた日数(営業開始前の日は数えない。当月は月末まで)。 */
function openDays(store, month) {
  const open = openDates[store];
  let n = 0;
  for (let d = 1; d <= daysInMonth(month); d++) {
    const iso = `${month}-${String(d).padStart(2, "0")}`;
    if (!open || iso >= open) n++;
  }
  return n;
}

function storeMonth(store, month) {
  const rows = tx.filter((r) => r.store === store && ym(r.date) === month);
  const used = rows.filter((r) => HOURS_USED_STATUSES.has(r.status) && r.hours_used > 0);
  const hours = used.reduce((s, r) => s + r.hours_used, 0);
  const freeHours = used.filter((r) => r.revenue === 0).reduce((s, r) => s + r.hours_used, 0);
  const usage = used.reduce((s, r) => s + effectiveRevenue(r), 0);
  const subscription = rows.filter((r) => r.status === SUBSCRIPTION_STATUS).reduce((s, r) => s + r.revenue, 0);
  const revenue = rows.reduce((s, r) => s + effectiveRevenue(r), 0);
  const expense = expenses.filter((e) => e.store === store && ym(e.date) === month).reduce((s, e) => s + e.amount, 0);
  const hpd = stores.find((s) => s.store === store)?.hpd ?? 14;
  const capacity = openDays(store, month) * hpd;
  return { revenue, usage, subscription, other: revenue - usage - subscription, hours, freeHours, expense, occupancy: capacity ? hours / capacity : 0 };
}

function totalMonth(month) {
  const rows = tx.filter((r) => ym(r.date) === month);
  const revenue = rows.reduce((s, r) => s + effectiveRevenue(r), 0);
  const subscription = rows.filter((r) => r.status === SUBSCRIPTION_STATUS).reduce((s, r) => s + r.revenue, 0);
  const monthExpenses = expenses.filter((e) => ym(e.date) === month);
  const expense = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const common = monthExpenses.filter((e) => !e.store).reduce((s, e) => s + e.amount, 0);
  return { revenue, subscription, expense, common, profit: revenue - expense };
}

// 初めての利用(全期間で見た最初の利用日)が各月にあったお客様。
const firstUse = new Map();
for (const r of db
  .prepare(`SELECT user_name, date, channel FROM transactions WHERE hours_used > 0 AND user_name IS NOT NULL AND user_name != '' ORDER BY date`)
  .all()) {
  if (!firstUse.has(r.user_name)) firstUse.set(r.user_name, r);
}

const out = [];
const partial = `${label(currentMonth)}は${today.slice(5).replace("-", "/")}時点の途中経過(これからの予約を含む)`;
out.push(`LUNAレンタルサロンの全体のまとめです(${label(months[0])}〜${label(currentMonth)})。${partial}。`);
out.push("売上は利用日の月で数えています(定額クーポンは購入した月)。経費は店舗を指定したものを各店舗に、それ以外は共通経費として全体にだけ入れています。");

out.push("", "■ 全体");
for (const m of months) {
  const t = totalMonth(m);
  out.push(`  ${label(m)}: 売上 ${yen(t.revenue)}(うち定額クーポン ${yen(t.subscription)}) / 経費 ${yen(t.expense)}(うち共通 ${yen(t.common)}) / 営業利益 ${yen(t.profit)}`);
}

for (const s of stores) {
  out.push("", `■ ${s.store}`);
  for (const m of months) {
    const r = storeMonth(s.store, m);
    const free = r.hours ? `、うち0円の利用 ${pct(r.freeHours / r.hours)}` : "";
    out.push(
      `  ${label(m)}: 売上 ${yen(r.revenue)}(利用 ${yen(r.usage)}・定額 ${yen(r.subscription)}${r.other ? `・キャンセル料など ${yen(r.other)}` : ""})` +
        ` / 利用 ${r.hours.toFixed(1)}h 稼働率 ${pct(r.occupancy)}${free} / 店舗の経費 ${yen(r.expense)} / 差し引き ${yen(r.revenue - r.expense)}`
    );
  }
}

out.push("", "■ 導線別の利用件数(キャンセルを除く)");
const channels = [...new Set(tx.map((r) => r.channel))].filter(Boolean).sort();
for (const m of months) {
  const used = tx.filter((r) => ym(r.date) === m && HOURS_USED_STATUSES.has(r.status) && r.hours_used > 0);
  out.push(`  ${label(m)}: ` + channels.map((c) => `${c} ${used.filter((r) => r.channel === c).length}件`).join(" / "));
}

out.push("", "■ 初めて利用したお客様(初回の導線別)");
for (const m of months) {
  const first = [...firstUse.values()].filter((r) => ym(r.date) === m);
  const byChannel = channels.map((c) => `${c} ${first.filter((r) => r.channel === c).length}`).join(" / ");
  out.push(`  ${label(m)}: ${first.length}名(${byChannel})`);
}

const year = today.slice(0, 4);
const ytdRevenue = db
  .prepare(`SELECT revenue, status FROM transactions WHERE substr(date, 1, 4) = ? AND date <= ?`)
  .all(year, today)
  .reduce((s, r) => s + effectiveRevenue(r), 0);
const ytdExpense = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS t FROM expenses WHERE substr(date, 1, 4) = ? AND date <= ?`).get(year, today).t;
out.push("", `■ ${year}年の累計(今日まで)`, `  売上 ${yen(ytdRevenue)} / 経費 ${yen(ytdExpense)} / 営業利益 ${yen(ytdRevenue - ytdExpense)}`);

const text = out.join("\n");
if (args.includes("--email")) {
  const { sendResultEmail } = await import("../src/notifyEmail.js");
  await sendResultEmail({ subject: `【LUNA】全体のまとめ(${label(months[0])}〜${label(currentMonth)})`, text });
  console.log("メールで送りました。");
} else {
  console.log(text);
}
