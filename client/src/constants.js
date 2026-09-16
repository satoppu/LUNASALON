export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#C2447A",
  Instabase: "#3E7FB0",
  スペースマーケット: "#C68A2E",
  その他: "#5D3C8C",
  定期クーポン: "#3E7FB0",
};

export const FONT_HEAD = "'Shippori Mincho', serif";
export const FONT_BODY = "'Noto Sans JP', sans-serif";

export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}

export function makeStoreColor(storeMeta) {
  return (name) => storeMeta?.[name]?.color || "#8F7B82";
}
