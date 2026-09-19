// CLI: one-time backfill of hours_used onto the historical スペースマーケット
// rows imported from LUNA_売上明細_2023-10_2026-09.xlsx. That export has no
// duration column, so every row was imported with hours_used=0; this fills
// in the real duration for rows matched against the user's separately
// supplied inbox PDF (date + guest name + listed HH:MM〜HH:MM time range).
// Matched by 予約ID (external_id) — see conversation history for how this
// mapping was derived. This is a one-off correction, not meant to be re-run
// for future imports (which won't have this problem once a duration column
// is available in the monthly CSV format).
//
// Usage: node src/backfillSpaceMarketHours.js [--dry-run]
import db from "./db.js";

const HOURS_BY_EXTERNAL_ID = {
  2424355: 2.5, 2445665: 1, 2462426: 1.5, 2453459: 1.5, 2487290: 1, 2525255: 2, 2537948: 1,
  2431228: 9.5, 2571828: 3.25, 2480103: 9.5, 2555899: 4.75, 2646657: 1.25, 2656531: 2.75,
  2555908: 4.75, 2715283: 1.5, 2787444: 1, 2801138: 1.25, 2894039: 2, 2919307: 2, 3007866: 6.5,
  3078005: 1.5, 3086071: 1.5, 3080928: 2, 3091242: 3, 3115229: 1.5, 3135627: 1.25, 3354701: 1,
  3366371: 1, 3376696: 2.25, 3375386: 1, 3423370: 3.75, 3450363: 1, 3450369: 1, 3485764: 1.5,
  3506802: 1, 3516054: 1, 3450379: 1, 3543319: 3, 3513852: 3, 3581666: 1.5, 3553030: 1,
  3605510: 1, 3601051: 3, 3633662: 4, 3616011: 3, 3684523: 2.5, 3685017: 2, 3698032: 1.25,
  3798291: 1.25, 3828148: 2.25, 3840163: 1.25, 3869230: 1.25, 3912394: 2, 4072928: 1,
  3892990: 2, 4099147: 5, 4361539: 3, 4366394: 1, 4475104: 1, 4494690: 2.5, 4558011: 1.5,
  4694508: 1, 4738478: 1.5, 4804434: 1.5, 4689370: 1.5, 5072557: 2, 5385698: 2.5, 5495225: 1.25,
  5563971: 8.5, 5495557: 1, 5522716: 2, 5789924: 3.5, 5740311: 4.25, 5842527: 2, 5880928: 2.25,
};

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const updateStmt = db.prepare(
    `UPDATE transactions SET hours_used = ? WHERE channel = 'スペースマーケット' AND external_id = ? AND hours_used = 0`
  );

  let updated = 0;
  let notFound = 0;
  for (const [externalId, hours] of Object.entries(HOURS_BY_EXTERNAL_ID)) {
    const existing = db
      .prepare(`SELECT id FROM transactions WHERE channel = 'スペースマーケット' AND external_id = ?`)
      .get(externalId);
    if (!existing) {
      notFound++;
      console.log(`not found: external_id=${externalId}`);
      continue;
    }
    if (!dryRun) updateStmt.run(hours, externalId);
    updated++;
  }

  console.log(dryRun ? "[dry run] would update:" : "updated:", updated, "/ not found:", notFound);
}

main();
