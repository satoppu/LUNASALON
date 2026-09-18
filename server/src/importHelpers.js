// Shared helpers for the raw-export import scripts (importRawBookings.js,
// importRawSubscriptions.js, importSubscriptions.js).
import db from "./db.js";
import { resolveAliasedName } from "./userNameAliases.js";

const WHITESPACE = /[\s　]/g;

/**
 * Normalizes an incoming customer name to its canonical form: house policy
 * is no whitespace between surname and given name (the reservation
 * platform's exports are inconsistently spaced — e.g. "HARUNA TAKAGI" vs
 * "HARUNATAKAGI" — for the same real person), so every name is stripped of
 * internal whitespace unconditionally rather than matched against whichever
 * spelling happened to exist first. Checks userNameAliases.js first for
 * pairings spacing alone can't catch (an abbreviated name, or a romanized
 * name vs its kanji spelling).
 */
export function canonicalizeUserName(rawName) {
  const cleaned = String(rawName).replace(/[(（].*$/, "").trim();

  const aliased = resolveAliasedName(cleaned);
  if (aliased) return aliased;

  return cleaned.replace(WHITESPACE, "");
}

/** The store a user has the most (non-subscription) transactions at, or null if they have none yet. */
export function resolveStoreForUser(userName) {
  const row = db
    .prepare("SELECT store, COUNT(*) c FROM transactions WHERE user_name = ? GROUP BY store ORDER BY c DESC LIMIT 1")
    .get(userName);
  return row?.store ?? null;
}
