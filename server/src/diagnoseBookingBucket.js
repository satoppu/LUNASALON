// Read-only diagnostic: shows exactly which rows land in a given month's
// 決済日ベース(合計) bucket on the 売上分析 chart (RevenuePage), and why —
// same bookingRevenueContributions() logic the chart itself uses, so this
// always matches what's on screen. Useful for "why is 決済日ベース so low
// for month X" — usually because a future usage month's bookings were
// actually paid for in an earlier month, so their revenue is booked against
// THAT month's 決済日ベース bucket instead, leaving the future month's
// bucket holding only rows that lack a booking_date (fall back to usage
// date) or cancellations confirmed in that month.
//
// Usage: node src/diagnoseBookingBucket.js 2026-11 2026-12
import db from "./db.js";
import { bookingRevenueContributions } from "./aggregations.js";

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("使い方: node src/diagnoseBookingBucket.js 2026-11 2026-12");
  process.exit(1);
}

const rows = db.prepare(`SELECT * FROM transactions`).all();

for (const ym of targets) {
  const matched = [];
  for (const r of rows) {
    for (const { month, amount } of bookingRevenueContributions(r)) {
      if (month === ym && amount !== 0) matched.push({ ...r, contributedAmount: amount });
    }
  }
  const total = matched.reduce((sum, r) => sum + r.contributedAmount, 0);
  console.log(`\n=== ${ym} 決済日ベース 合計: ¥${total.toLocaleString()} (${matched.length}件) ===`);
  for (const r of matched.sort((a, b) => (a.booking_date || a.date).localeCompare(b.booking_date || b.date))) {
    console.log(
      `  利用日=${r.date} 決済日=${r.booking_date ?? "(なし→利用日を代用)"} 確定日=${r.revenue_confirmed_date ?? "-"} ` +
        `${r.store} ${r.user_name} ¥${r.contributedAmount} status=${r.status} channel=${r.channel}`
    );
  }
}
