import type { TranslationKey } from "../i18n";
/**
 * Shared client-side validation that mirrors the backend contracts, so screens
 * don't each reimplement (and drift from) the rules.
 */

/**
 * Password policy — 8–64 characters plus a letter, a digit and at least one
 * special character (`src/modules/auth/application/password_policy.py`).
 * Returns the catalog key of the problem, or `null` when it is acceptable.
 *
 * Like the server, length counts code points (Python `len`), and "special"
 * means neither a letter nor a number in ANY script (`not str.isalnum()`), so
 * Hangul never stands in for the symbol. The letter/digit checks stay ASCII,
 * matching the copy ("영문·숫자"); that is stricter than the server, never looser.
 */
export function passwordProblem(p: string): TranslationKey | null {
  const length = [...p].length;
  if (length < 8 || length > 64) return "validation.passwordLength";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p) || !/[^\p{L}\p{N}]/u.test(p))
    return "validation.passwordComposition";
  return null;
}
