import type { TranslationKey } from "../i18n";
/**
 * Shared client-side validation that mirrors the backend contracts, so screens
 * don't each reimplement (and drift from) the rules.
 */

/**
 * Password policy — matches the backend: 8–64 chars (Pydantic `min/max_length`)
 * plus letters + digits + at least one special character
 * (`src/modules/auth/application/password_policy.py`). Returns the catalog key
 * of the problem, or `null` when the password is acceptable.
 */
export function passwordProblem(p: string): TranslationKey | null {
  if (p.length < 8 || p.length > 64) return "validation.passwordLength";
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p) || !/[^a-zA-Z0-9]/.test(p))
    return "validation.passwordComposition";
  return null;
}
