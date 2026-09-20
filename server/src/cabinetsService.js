// キャビネット利用/定額クーポンIDの管理。どちらも既存のtransactionsとは
// 別の小さな参照テーブル(数十行程度)で、顧客詳細(顧客一覧)に表示する際は
// canonicalizeUserNameでの緩いつき合わせ(空白・全角半角・登録済みエイリアス
// 差異を吸収)で紐付ける。完全一致しない場合(表記ゆれの人名など)は、この
// 画面から直接ユーザー名を編集して修正する想定。
import db from "./db.js";
import { canonicalizeUserName } from "./importHelpers.js";

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
