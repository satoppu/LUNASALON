// One-time seed data transcribed from the salon's own management spreadsheet
// (キャビネット利用/定額クーポンのID, provided 2026-09-20). Seeded into
// cabinet_assignments/coupon_ids on first run only (see db.js) — from then
// on the database is the source of truth, edited via the「キャビネット・
// クーポン」management screen, same pattern as DEFAULT_STORES/store_settings.

// slot: the physical cabinet number/position ("6/上","7/下" are distinct
// slots, not a split of one). A (store, slot) pair only appears here when
// that slot actually exists at that store — Forest/Asteria don't have every
// slot Bellezza does. user: null means the slot exists but is currently
// unassigned ("空き" in the source sheet).
export const INITIAL_CABINETS = [
  { store: "Bellezza", slot: "1", sortOrder: 1, user: "高木春菜" },
  { store: "Bellezza", slot: "2", sortOrder: 2, user: "小串健志" },
  { store: "Bellezza", slot: "3", sortOrder: 3, user: "坂下美紀" },
  { store: "Bellezza", slot: "4", sortOrder: 4, user: "小西真子" },
  { store: "Bellezza", slot: "5", sortOrder: 5, user: "杉志乃" },
  { store: "Bellezza", slot: "6/上", sortOrder: 6, user: null },
  { store: "Bellezza", slot: "7/下", sortOrder: 7, user: "高木春菜" },
  { store: "Forest", slot: "1", sortOrder: 1, user: "高木春菜" },
  { store: "Forest", slot: "2", sortOrder: 2, user: "斉藤麻希" },
  { store: "Forest", slot: "3", sortOrder: 3, user: "姜秀珍" },
  { store: "Forest", slot: "6/上", sortOrder: 6, user: "佐久間順子" },
  { store: "Forest", slot: "7/下", sortOrder: 7, user: null },
  { store: "Asteria", slot: "1", sortOrder: 1, user: "岡本沙樹" },
  { store: "Asteria", slot: "2", sortOrder: 2, user: "砂川美菜" },
  { store: "Asteria", slot: "3", sortOrder: 3, user: null },
];

// id: null means the ID exists but currently isn't assigned to anyone.
export const INITIAL_COUPONS = [
  { id: "Ax", sortOrder: 1, user: "杉志乃" },
  { id: "Bx", sortOrder: 2, user: "高木春菜" },
  { id: "Cx", sortOrder: 3, user: "篠原香奈子" },
  { id: "Dx", sortOrder: 4, user: "宮山佐和子" },
  { id: "Ex", sortOrder: 5, user: "樋口愛美" },
  { id: "Fx", sortOrder: 6, user: "硯川紗千子" },
  { id: "Gx", sortOrder: 7, user: "三上ひろみ" },
  { id: "Hx", sortOrder: 8, user: null },
  { id: "Ix", sortOrder: 9, user: null },
  { id: "Jx", sortOrder: 10, user: "根本祐美" },
  { id: "Kx", sortOrder: 11, user: "佐久間順子" },
  { id: "Lx", sortOrder: 12, user: "斉藤麻希" },
  { id: "Mx", sortOrder: 13, user: "平野恵" },
  { id: "Nx", sortOrder: 14, user: "姜秀珍" },
  { id: "Ox", sortOrder: 15, user: "山本智美" },
  { id: "Px", sortOrder: 16, user: "岡本沙樹" },
  { id: "Qx", sortOrder: 17, user: "ハトミ美貴" },
  { id: "Rx", sortOrder: 18, user: null },
  { id: "Sx", sortOrder: 19, user: "砂川美菜" },
  { id: "Tx", sortOrder: 20, user: "坂下美紀" },
];
