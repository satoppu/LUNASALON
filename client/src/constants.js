export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#D9738F",
  Instabase: "#D4A644",
  スペースマーケット: "#D66B5C",
  その他: "#8F4A28",
  定期クーポン: "#D9738F",
};

// Single-letter badge for 利用履歴's 導線 column: 自社サイト uses the LUNA
// logo's brand gold, Instabase blue, スペースマーケット green — the letter
// itself (自/I/S) carries the distinction so color alone never has to.
export const CHANNEL_BADGE = {
  自社サイト: { label: "自", bg: "#D4A644", text: "#262421" },
  Instabase: { label: "I", bg: "#3D6FB5", text: "#FFFFFF" },
  スペースマーケット: { label: "S", bg: "#347A50", text: "#FFFFFF" },
  定期クーポン: { label: "定", bg: "#B54F72", text: "#FFFFFF" },
};

// Same one-glyph badge treatment for 状態 (booking status). Each status gets
// its own character, so two similarly-toned cancellation variants still read
// unambiguously without depending on the viewer telling the colors apart.
export const STATUS_BADGE = {
  利用済み: { label: "済", bg: "#D4A644", text: "#262421" },
  利用前: { label: "予", bg: "#756253", text: "#FFFFFF" },
  定期クーポン: { label: "定", bg: "#B54F72", text: "#FFFFFF" },
  "キャンセル(顧客)": { label: "キ", bg: "#A84434", text: "#FFFFFF" },
  "キャンセル(返金あり)": { label: "返", bg: "#B8543F", text: "#FFFFFF" },
  "キャンセル(オーナー)": { label: "オ", bg: "#8F4A28", text: "#FFFFFF" },
};

export const FONT_HEAD = "'Shippori Mincho', serif";
export const FONT_BODY = "'Noto Sans JP', sans-serif";

export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

export function makeStoreColor(storeMeta) {
  return (name) => storeMeta?.[name]?.color || "#8F7D6E";
}

// "2026-09-17" -> "26.09.17" (yy.mm.dd) — compact enough for a date column
// to fit next to name/revenue columns on a phone without horizontal
// scrolling, while keeping the year-month-day order used everywhere else
// in the app (date pickers, ISO dates) so it doesn't read backwards.
export function formatDateShort(dateStr) {
  return dateStr.slice(2).replace(/-/g, ".");
}
