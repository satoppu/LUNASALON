// CLI: backfills booking_date onto already-imported 自社サイト rows that
// predate external_id tracking (the historical bundled CSV), by matching a
// raw booking export's rows to them on content — see
// importService.js/backfillBookingDate for the matching rules.
//
// Usage: node src/backfillBookingDate.js <path-to-raw-booking-export.csv>
import fs from "node:fs";
import { backfillBookingDate } from "./importService.js";

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node src/backfillBookingDate.js <path-to-raw-booking-export.csv>");
    process.exit(1);
  }

  const csvText = fs.readFileSync(inputPath, "utf-8");
  const result = backfillBookingDate(csvText);
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  console.log(result);
}

main();
