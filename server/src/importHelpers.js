// Shared helpers for the raw-export import scripts (importRawBookings.js,
// importRawSubscriptions.js, importSubscriptions.js).
import db from "./db.js";
import { resolveAliasedName } from "./userNameAliases.js";

const WHITESPACE = /[\s　]/g;

/**
 * Matches an incoming customer name against existing transactions, ignoring
 * all whitespace — the reservation platform's exports are inconsistently
 * spaced (e.g. "HARUNA TAKAGI" vs the existing "HARUNATAKAGI") for the same
 * real person — so the same customer's history stays under one canonical
 * user_name instead of fragmenting across imports. Also checks
 * userNameAliases.js first for pairings spacing alone can't catch (an
 * abbreviated name, or a romanized name vs its kanji spelling). Falls back
 * to the cleaned input (parenthetical nickname suffix stripped) when
 * nothing matches.
 */
export function canonicalizeUserName(rawName) {
  const cleaned = String(rawName).replace(/[(（].*$/, "").trim();

  const aliased = resolveAliasedName(cleaned);
  if (aliased) return aliased;

  const exact = db.prepare("SELECT 1 FROM transactions WHERE user_name = ? LIMIT 1").get(cleaned);
  if (exact) return cleaned;

  const stripped = cleaned.replace(WHITESPACE, "");
  const candidates = db.prepare("SELECT DISTINCT user_name FROM transactions").all();
  const match = candidates.find((c) => c.user_name.replace(WHITESPACE, "") === stripped);
  return match ? match.user_name : cleaned;
}

/** The store a user has the most (non-subscription) transactions at, or null if they have none yet. */
export function resolveStoreForUser(userName) {
  const row = db
    .prepare("SELECT store, COUNT(*) c FROM transactions WHERE user_name = ? GROUP BY store ORDER BY c DESC LIMIT 1")
    .get(userName);
  return row?.store ?? null;
}
