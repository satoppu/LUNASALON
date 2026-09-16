export const CHANNELS = ["自社サイト", "Instabase", "スペースマーケット", "その他"];

export const CHANNEL_COLOR = {
  自社サイト: "#262421",
  Instabase: "#3B6FA0",
  スペースマーケット: "#4E8F5B",
  その他: "#B0A99A",
};

export const FONT_HEAD = "'Shippori Mincho', serif";
export const FONT_BODY = "'Noto Sans JP', sans-serif";

export function yen(n) {
  return "¥" + Math.round(n).toLocaleString("ja-JP");
}
