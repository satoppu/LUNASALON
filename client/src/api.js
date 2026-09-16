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
  getCustomers: () => request("/customers"),
  searchTransactions: ({ start, end } = {}) => {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    const qs = params.toString();
    return request(`/transactions${qs ? `?${qs}` : ""}`);
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
};
