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
  { canonical: "HARUNATAKAGI", aliases: ["高木春菜", "高木 春菜"] },
  { canonical: "五十嵐", aliases: ["五十嵐賢一", "五十嵐 賢一", "五十嵐健一", "五十嵐 健一"] },
];

/** Exact-match (post-trim) lookup: alias spelling -> its canonical name, or null. */
export function resolveAliasedName(name) {
  for (const { canonical, aliases } of USER_NAME_ALIASES) {
    if (aliases.includes(name)) return canonical;
  }
  return null;
}
