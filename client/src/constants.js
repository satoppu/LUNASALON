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
};

export const FONT_HEAD = "'Shippori Mincho', serif";
export const FONT_BODY = "'Noto Sans JP', sans-serif";

export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

export function makeStoreColor(storeMeta) {
  return (name) => storeMeta?.[name]?.color || "#8F7D6E";
}
