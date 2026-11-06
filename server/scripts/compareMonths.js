// 2つの月の売上・利用時間・件数を、導線別・定額クーポン利用の有無で比べる(売上が伸びない理由を探す用)。
// Usage: node scripts/compareMonths.js 2026-09 2026-10
const { default: db } = await import("../src/db.js");
const { REVENUE_STATUSES, HOURS_USED_STATUSES, SUBSCRIPTION_STATUS } = await import("../src/config.js");

const months = process.argv.slice(2).filter((a) => /^\d{4}-\d{2}$/.test(a));
if (months.length !== 2) {
  console.error("例: node scripts/compareMonths.js 2026-09 2026-10");
  process.exit(1);
}
const yen = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const pad = (s, n) => String(s).padEnd(n, "　");

function summarize(ym) {
  const rows = db.prepare(`SELECT * FROM transactions WHERE substr(date, 1, 7) = ?`).all(ym);
  const used = rows.filter((r) => HOURS_USED_STATUSES.has(r.status) && r.hours_used > 0);
  const byChannel = {};
  for (const r of used) {
    const key = r.revenue > 0 ? r.channel : `${r.channel}(0円=クーポン等)`;
    const s = (byChannel[key] ??= { count: 0, hours: 0, revenue: 0 });
    s.count++;
    s.hours += r.hours_used;
    s.revenue += r.revenue;
  }
  const usageRevenue = used.reduce((s, r) => s + r.revenue, 0);
  const cancelRevenue = rows.filter((r) => r.status.startsWith("キャンセル") && REVENUE_STATUSES.has(r.status)).reduce((s, r) => s + r.revenue, 0);
  const coupon = rows.filter((r) => r.status === SUBSCRIPTION_STATUS);
  const pending = used.filter((r) => r.status === "利用前");
  return {
    ym,
    count: used.length,
    hours: used.reduce((s, r) => s + r.hours_used, 0),
    usageRevenue,
    cancelRevenue,
    couponCount: coupon.length,
    couponRevenue: coupon.reduce((s, r) => s + r.revenue, 0),
    pendingCount: pending.length,
    byChannel,
  };
}

const [a, b] = months.map(summarize);
const line = (label, fa, fb, fmt = (x) => x) => console.log(`${pad(label, 14)} ${String(fmt(fa)).padStart(10)}  →  ${String(fmt(fb)).padStart(10)}`);
console.log(`\n${pad("", 14)} ${a.ym.padStart(10)}  →  ${b.ym.padStart(10)}`);
line("利用件数", a.count, b.count);
line("利用時間", a.hours, b.hours, (x) => x.toFixed(1) + "h");
line("利用売上", a.usageRevenue, b.usageRevenue, yen);
line("1時間あたり", a.usageRevenue / a.hours, b.usageRevenue / b.hours, yen);
line("キャンセル料", a.cancelRevenue, b.cancelRevenue, yen);
line("定額クーポン購入", a.couponCount, b.couponCount, (x) => x + "件");
line("定額クーポン売上", a.couponRevenue, b.couponRevenue, yen);
line("合計売上", a.usageRevenue + a.cancelRevenue + a.couponRevenue, b.usageRevenue + b.cancelRevenue + b.couponRevenue, yen);
line("うち利用前の予約", a.pendingCount, b.pendingCount, (x) => x + "件");

console.log("\n【導線別の利用(件数 / 時間 / 売上 / 1時間あたり)】");
const keys = [...new Set([...Object.keys(a.byChannel), ...Object.keys(b.byChannel)])].sort();
for (const k of keys) {
  for (const s of [a, b]) {
    const c = s.byChannel[k] ?? { count: 0, hours: 0, revenue: 0 };
    console.log(`${pad(s === a ? k : "", 20)} ${s.ym}: ${String(c.count).padStart(3)}件 ${c.hours.toFixed(1).padStart(6)}h ${yen(c.revenue).padStart(9)} ${c.hours ? yen(c.revenue / c.hours).padStart(7) : "      -"}/h`);
  }
}
