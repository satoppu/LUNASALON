export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#D9738F",
  Instabase: "#D4A644",
  スペースマーケット: "#D66B5C",
  その他: "#8F4A28",
  定期クーポン: "#D9738F",
};

export const FONT_HEAD = "'Shippori Mincho', serif";
export const FONT_BODY = "'Noto Sans JP', sans-serif";

export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

export function makeStoreColor(storeMeta) {
  return (name) => storeMeta?.[name]?.color || "#8F7D6E";
}
