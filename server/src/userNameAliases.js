// Manually confirmed same-customer aliases that canonicalizeUserName's
// automatic whitespace-insensitive matching can't detect on its own — an
// abbreviated name vs the full name, or a romanized name vs its kanji
// spelling, rather than just inconsistent spacing. The business confirmed
// each of these pairs is the same real customer; add more entries here as
// more are found. `canonical` is whichever spelling should "win" (usually
// the one already used most in the data); everything in `aliases` merges
// onto it, both retroactively (dedupeUserNames.js) and for future imports
// (canonicalizeUserName).
export const USER_NAME_ALIASES = [
  { canonical: "高木春菜", aliases: ["HARUNATAKAGI", "高木 春菜", "髙木春菜"] },
  { canonical: "五十嵐健一", aliases: ["五十嵐", "五十嵐賢一", "五十嵐 賢一", "五十嵐 健一"] },
  { canonical: "小串健志", aliases: ["オグシケンジ", "オグシ", "小串健次", "小串健司", "小串 健志", "小串健治"] },
  { canonical: "藤田聡之", aliases: ["藤田聡之(藤田聡之（さとっぷ）)"] },
  { canonical: "川北紫明", aliases: ["川北紫朗"] },
  { canonical: "中川舞", aliases: ["MAINAKAGAWA"] },
  { canonical: "斉藤麻希", aliases: ["齋藤麻希", "斎藤麻希"] },
  { canonical: "宮山佐和子", aliases: ["後藤佐和子"] },
  { canonical: "野水真由美", aliases: ["野水舞由美"] },
  { canonical: "野尻真末", aliases: ["野尻真未"] },
  { canonical: "跡部友里", aliases: ["跡部友理"] },
  { canonical: "藤田尚子", aliases: ["藤田ひさこ"] },
  { canonical: "反町慎之介", aliases: ["反町槙之介"] },
];

/** Exact-match (post-trim) lookup: alias spelling -> its canonical name, or null. */
export function resolveAliasedName(name) {
  for (const { canonical, aliases } of USER_NAME_ALIASES) {
    if (aliases.includes(name)) return canonical;
  }
  return null;
}
