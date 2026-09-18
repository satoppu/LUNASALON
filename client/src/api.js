const BASE = "/api";

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getDashboard: (year) => request(`/dashboard${year ? `?year=${year}` : ""}`),
  getYears: () => request("/years"),
  getYoyByStore: (year, month) => request(`/revenue/yoy-by-store?year=${year}${month ? `&month=${month}` : ""}`),
  getCustomers: () => request("/customers"),
  searchTransactions: ({ start, end, store, status, user, offset, sort } = {}) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (store) params.set("store", store);
    if (status) params.set("status", status);
    if (user) params.set("user", user);
    if (offset) params.set("offset", offset);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
  },
  getTransactionFilters: () => request("/transactions/filters"),
  transactionsExportUrl: ({ start, end, store, status, user, sort } = {}) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (store) params.set("store", store);
    if (status) params.set("status", status);
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
  templateUrl: `${BASE}/template`,
  getPageNote: (pageKey) => request(`/page-notes/${encodeURIComponent(pageKey)}`),
  savePageNote: (pageKey, payload) =>
    request(`/page-notes/${encodeURIComponent(pageKey)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
