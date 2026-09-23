const BASE = "/api";

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    }),
  getDashboard: (year) => request(`/dashboard${year ? `?year=${year}` : ""}`),
  getNewBookingsDaily: (offset, store) => {
    const params = new URLSearchParams();
    if (offset) params.set("offset", offset);
    if (store) params.set("store", store);
    const qs = params.toString();
    return request(`/dashboard/new-bookings-daily${qs ? `?${qs}` : ""}`);
  },
  getBookingsForDate: (date, store) => {
    const params = new URLSearchParams({ date });
    if (store) params.set("store", store);
    return request(`/dashboard/new-bookings-daily/detail?${params.toString()}`);
  },
  getUsageDaily: (offset, store) => {
    const params = new URLSearchParams();
    if (offset) params.set("offset", offset);
    if (store) params.set("store", store);
    const qs = params.toString();
    return request(`/dashboard/usage-daily${qs ? `?${qs}` : ""}`);
  },
  getUsageForDate: (date, store) => {
    const params = new URLSearchParams({ date });
    if (store) params.set("store", store);
    return request(`/dashboard/usage-daily/detail?${params.toString()}`);
  },
  getYears: () => request("/years"),
  getYoyByStore: (year, month, store) => {
    const params = new URLSearchParams({ year });
    if (month) params.set("month", month);
    if (store) params.set("store", store);
    return request(`/revenue/yoy-by-store?${params.toString()}`);
  },
  getRevenue: (year, store) => {
    const params = new URLSearchParams();
    if (year) params.set("year", year);
    if (store) params.set("store", store);
    const qs = params.toString();
    return request(`/revenue${qs ? `?${qs}` : ""}`);
  },
  getCustomers: () => request("/customers"),
  searchTransactions: ({ start, end, store, status, channel, user, offset, sort } = {}) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (store) params.set("store", store);
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    if (user) params.set("user", user);
    if (offset) params.set("offset", offset);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  getTransactionFilters: () => request("/transactions/filters"),
  transactionsExportUrl: ({ start, end, store, status, channel, user, sort } = {}) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (store) params.set("store", store);
    if (status) params.set("status", status);
    if (channel) params.set("channel", channel);
    if (user) params.set("user", user);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return `${BASE}/transactions/export${qs ? `?${qs}` : ""}`;
  },
  getStoreSettings: () => request("/store-settings"),
  updateStoreSetting: (store, payload) =>
    request(`/store-settings/${encodeURIComponent(store)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  importCsv: async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${BASE}/import`, { method: "POST", body: formData });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "インポートに失敗しました。");
    return body;
  },
  getPageNote: (pageKey) => request(`/page-notes/${encodeURIComponent(pageKey)}`),
  savePageNote: (pageKey, payload) =>
    request(`/page-notes/${encodeURIComponent(pageKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  getCabinets: () => request("/cabinets"),
  createCabinet: (payload) =>
    request("/cabinets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateCabinet: (id, payload) =>
    request(`/cabinets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteCabinet: (id) => request(`/cabinets/${id}`, { method: "DELETE" }),
  getCoupons: () => request("/coupons"),
  getCouponPurchases: () => request("/coupons/purchases"),
  createCoupon: (payload) =>
    request("/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateCoupon: (id, payload) =>
    request(`/coupons/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteCoupon: (id) => request(`/coupons/${id}`, { method: "DELETE" }),
  getManualSpaceMarketTransactions: () => request("/manual-space-market"),
  getKnownUserNames: () => request("/manual-space-market/user-names"),
  createManualSpaceMarketTransaction: (payload) =>
    request("/manual-space-market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateManualSpaceMarketTransaction: (id, payload) =>
    request(`/manual-space-market/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteManualSpaceMarketTransaction: (id) => request(`/manual-space-market/${id}`, { method: "DELETE" }),
  getBusinessEvents: () => request("/business-events"),
  createBusinessEvent: (payload) =>
    request("/business-events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  updateBusinessEvent: (id, payload) =>
    request(`/business-events/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deleteBusinessEvent: (id) => request(`/business-events/${id}`, { method: "DELETE" }),
};
