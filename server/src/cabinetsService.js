// キャビネット利用/定額クーポンIDの管理。どちらも既存のtransactionsとは
// 別の小さな参照テーブル(数十行程度)で、顧客詳細(顧客一覧)に表示する際は
// canonicalizeUserNameでの緩いつき合わせ(空白・全角半角・登録済みエイリアス
// 差異を吸収)で紐付ける。完全一致しない場合(表記ゆれの人名など)は、この
// 画面から直接ユーザー名を編集して修正する想定。
import db from "./db.js";
import { canonicalizeUserName } from "./importHelpers.js";
import { SUBSCRIPTION_STATUS, HOURS_USED_STATUSES, getTodayISO } from "./config.js";

function normalizeUserNameInput(userName) {
  const trimmed = typeof userName === "string" ? userName.trim() : "";
  return trimmed === "" ? null : trimmed;
}

export function listCabinets() {
  return db.prepare(`SELECT * FROM cabinet_assignments ORDER BY store, sort_order, id`).all();
}

export function createCabinet({ store, slotLabel, userName, sortOrder }) {
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM cabinet_assignments WHERE store = ?`).get(store).m;
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO cabinet_assignments (store, slot_label, sort_order, user_name) VALUES (?, ?, ?, ?)`)
    .run(store, slotLabel, sortOrder ?? maxOrder + 1, normalizeUserNameInput(userName));
  return db.prepare(`SELECT * FROM cabinet_assignments WHERE id = ?`).get(lastInsertRowid);
}

export function updateCabinet(id, { store, slotLabel, userName }) {
  const existing = db.prepare(`SELECT * FROM cabinet_assignments WHERE id = ?`).get(id);
  if (!existing) return null;
  const next = {
    store: store !== undefined ? store : existing.store,
    slot_label: slotLabel !== undefined ? slotLabel : existing.slot_label,
    user_name: userName !== undefined ? normalizeUserNameInput(userName) : existing.user_name,
  };
  db.prepare(`UPDATE cabinet_assignments SET store = ?, slot_label = ?, user_name = ? WHERE id = ?`).run(
    next.store,
    next.slot_label,
    next.user_name,
    id
  );
  return db.prepare(`SELECT * FROM cabinet_assignments WHERE id = ?`).get(id);
}

export function deleteCabinet(id) {
  db.prepare(`DELETE FROM cabinet_assignments WHERE id = ?`).run(id);
}

// 今日を基準にした当月・前月・前々月(YYYY-MM)。年またぎも Date のロール
// オーバーに任せる(例: 1月なら前月=前年12月、前々月=前年11月)。
function recentMonths() {
  const [y, m] = getTodayISO().split("-").map(Number);
  const toYM = (offset) => {
    const d = new Date(y, m - 1 + offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1, ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
  };
  return { current: toYM(0), prev: toYM(-1), prev2: toYM(-2) };
}

/**
 * 提供一覧(ReferencePage.jsx)のキャビネット貸し出し一覧向け — 各行の
 * 利用者について、当月・前月・前々月の利用回数(実際に利用した行数、spec
 * 4.3と同じ基準)をcanonicalizeUserNameでの緩いつき合わせで付け足す。未割当
 * (空き)行や、表記ゆれで一致しない利用者はnullになる。当月分はまだ月の
 * 途中の値(進行中の集計)である点に注意。
 */
export function listCabinetsWithRecentUsage() {
  const cabinets = listCabinets();
  const { current, prev, prev2 } = recentMonths();

  const rows = db
    .prepare(`SELECT user_name, substr(date, 1, 7) AS ym, status FROM transactions WHERE substr(date, 1, 7) IN (?, ?, ?)`)
    .all(current.ym, prev.ym, prev2.ym);

  const countsByKey = new Map();
  for (const r of rows) {
    if (!HOURS_USED_STATUSES.has(r.status)) continue;
    const key = `${canonicalizeUserName(r.user_name)}|${r.ym}`;
    countsByKey.set(key, (countsByKey.get(key) || 0) + 1);
  }

  return cabinets.map((c) => {
    const key = c.user_name ? canonicalizeUserName(c.user_name) : null;
    return {
      ...c,
      currentMonthLabel: `${current.month}月`,
      currentMonthCount: key ? countsByKey.get(`${key}|${current.ym}`) || 0 : null,
      prevMonthLabel: `${prev.month}月`,
      prevMonthCount: key ? countsByKey.get(`${key}|${prev.ym}`) || 0 : null,
      prevMonth2Label: `${prev2.month}月`,
      prevMonth2Count: key ? countsByKey.get(`${key}|${prev2.ym}`) || 0 : null,
    };
  });
}

export function listCoupons() {
  return db.prepare(`SELECT * FROM coupon_ids ORDER BY sort_order, id`).all();
}

export function createCoupon({ couponId, userName, sortOrder }) {
  const maxOrder = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM coupon_ids`).get().m;
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO coupon_ids (coupon_id, sort_order, user_name) VALUES (?, ?, ?)`)
    .run(couponId, sortOrder ?? maxOrder + 1, normalizeUserNameInput(userName));
  return db.prepare(`SELECT * FROM coupon_ids WHERE id = ?`).get(lastInsertRowid);
}

export function updateCoupon(id, { couponId, userName }) {
  const existing = db.prepare(`SELECT * FROM coupon_ids WHERE id = ?`).get(id);
  if (!existing) return null;
  const next = {
    coupon_id: couponId !== undefined ? couponId : existing.coupon_id,
    user_name: userName !== undefined ? normalizeUserNameInput(userName) : existing.user_name,
  };
  db.prepare(`UPDATE coupon_ids SET coupon_id = ?, user_name = ? WHERE id = ?`).run(next.coupon_id, next.user_name, id);
  return db.prepare(`SELECT * FROM coupon_ids WHERE id = ?`).get(id);
}

export function deleteCoupon(id) {
  db.prepare(`DELETE FROM coupon_ids WHERE id = ?`).run(id);
}

/**
 * customerProfiles(buildCustomerProfilesの出力)の各要素に、対応する
 * キャビネット利用/クーポンIDを付け足す。canonicalizeUserNameで一致した
 * ものだけを紐付ける(未割当や表記ゆれで一致しない行は付かない)。
 */
export function attachAssignments(customerProfiles) {
  const cabinetsByUser = new Map();
  for (const c of listCabinets()) {
    if (!c.user_name) continue;
    const key = canonicalizeUserName(c.user_name);
    if (!cabinetsByUser.has(key)) cabinetsByUser.set(key, []);
    cabinetsByUser.get(key).push({ store: c.store, slotLabel: c.slot_label });
  }

  const couponsByUser = new Map();
  for (const c of listCoupons()) {
    if (!c.user_name) continue;
    const key = canonicalizeUserName(c.user_name);
    if (!couponsByUser.has(key)) couponsByUser.set(key, []);
    couponsByUser.get(key).push(c.coupon_id);
  }

  return customerProfiles.map((customer) => {
    const key = canonicalizeUserName(customer.user);
    return {
      ...customer,
      cabinets: cabinetsByUser.get(key) || [],
      couponIds: couponsByUser.get(key) || [],
    };
  });
}

/**
 * 定額クーポンの一覧(利用者・初回購入日・最近の購入日・購入回数)。1利用者
 * 1行で、購入実績のある利用者に加え、クーポンIDが割り当てられているが
 * transactionsに購入実績が無い利用者(購入回数0)も含める。最近の購入日の
 * 新しい順に並べ、購入実績の無い利用者は末尾に置く。
 */
export function buildCouponPurchaseList(allRows) {
  const byUser = new Map();
  const entryFor = (userName) => {
    const key = canonicalizeUserName(userName);
    if (!byUser.has(key)) byUser.set(key, { user: userName, firstPurchaseDate: null, lastPurchaseDate: null, purchaseCount: 0 });
    return byUser.get(key);
  };

  for (const c of listCoupons()) {
    if (c.user_name) entryFor(c.user_name);
  }
  for (const r of allRows) {
    if (r.status !== SUBSCRIPTION_STATUS) continue;
    const entry = entryFor(r.user_name);
    entry.purchaseCount += 1;
    if (entry.firstPurchaseDate === null || r.date < entry.firstPurchaseDate) entry.firstPurchaseDate = r.date;
    if (entry.lastPurchaseDate === null || r.date > entry.lastPurchaseDate) entry.lastPurchaseDate = r.date;
  }

  return [...byUser.values()].sort((a, b) => {
    if (a.lastPurchaseDate === b.lastPurchaseDate) return 0;
    if (a.lastPurchaseDate === null) return 1;
    if (b.lastPurchaseDate === null) return -1;
    return a.lastPurchaseDate < b.lastPurchaseDate ? 1 : -1;
  });
}
