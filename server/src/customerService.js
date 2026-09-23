import db from "./db.js";
import {
  buildCustomerProfiles,
  buildNewCustomersByMonth,
  buildActiveCustomersByMonth,
  buildBookingLeadTime,
  buildBookingToUsageMonthly,
  buildBookingToUsageMonthlyHours,
} from "./aggregations.js";
import { attachAssignments } from "./cabinetsService.js";

function getAllRows() {
  return db.prepare(`SELECT date, store, user_name, revenue, hours_used, status, channel, booking_date FROM transactions`).all();
}

export function getCustomerAnalysis() {
  const allRows = getAllRows();
  const customers = attachAssignments(buildCustomerProfiles(allRows));
  return {
    customers,
    newCustomersByMonth: buildNewCustomersByMonth(customers),
    activeCustomersByMonth: buildActiveCustomersByMonth(allRows),
    bookingLeadTime: buildBookingLeadTime(allRows),
    bookingToUsageMonthly: buildBookingToUsageMonthly(allRows),
    bookingToUsageMonthlyHours: buildBookingToUsageMonthlyHours(allRows),
  };
}
