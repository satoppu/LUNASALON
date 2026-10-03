// Read-only diagnostic: shows exactly which rows land in a given month's
// 決済日ベース(合計) bucket on the 売上分析 chart (RevenuePage) — same logic
// aggregations.js's buildDashboard uses for monthlyTrend.決済日ベース: every
// row's bookingRevenueContributions(), kept only when the contribution's own
// year matches the target year/month exactly (a booking paid in a different
// year never counts toward this one, even if the calendar month matches).
//
// Usage: node src/diagnoseBookingBucket.js 2026-11 2026-12
import db from "./db.js";
import { bookingRevenueContributions } from "./aggregations.js";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("使い方: node src/diagnoseBookingBucket.js 2026-11 2026-12");
  process.exit(1);
}

const allRows = db.prepare(`SELECT * FROM transactions`).all();

for (const ym of targets) {
  const matched = [];
  for (const r of allRows) {
    for (const { month, amount } of bookingRevenueContributions(r)) {
      if (month === ym && amount !== 0) matched.push({ ...r, contributedAmount: amount });
    }
  }

  const total = matched.reduce((sum, r) => sum + r.contributedAmount, 0);
  console.log(`\n=== ${ym} 決済日ベース 合計: ¥${total.toLocaleString()} (${matched.length}件) ===`);
  for (const r of matched.sort((a, b) => a.date.localeCompare(b.date))) {
    console.log(
      `  利用日=${r.date} 決済日=${r.booking_date ?? "(なし→利用日を代用)"} 確定日=${r.revenue_confirmed_date ?? "-"} ` +
        `${r.store} ${r.user_name} ¥${r.contributedAmount} status=${r.status} channel=${r.channel}`
    );
  }
}
