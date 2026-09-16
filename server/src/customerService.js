import db from "./db.js";
import {
  buildCustomerProfiles,
  buildNewCustomersByMonth,
  buildActiveCustomersByMonth,
  buildBookingLeadTime,
} from "./aggregations.js";

function getAllRows() {
  return db.prepare(`SELECT date, store, user_name, revenue, hours_used, status, booking_date FROM transactions`).all();
}

export function getCustomerAnalysis() {
  const allRows = getAllRows();
  const customers = buildCustomerProfiles(allRows);
  return {
    customers,
    newCustomersByMonth: buildNewCustomersByMonth(customers),
    activeCustomersByMonth: buildActiveCustomersByMonth(allRows),
    bookingLeadTime: buildBookingLeadTime(allRows),
  };
}
