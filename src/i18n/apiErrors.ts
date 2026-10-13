/**
 * The member app's wording for a server error, in the active language.
 *
 * The server's problem `detail` is English for developers and logs; members
 * see the sentence the catalog keeps for the problem's `details.reason` (when
 * the server gives one) or else its `code`. `{name}` slots are filled from
 * `details`; a sentence whose slots `details` cannot fill is skipped rather
 * than shown with a bare `{name}`.
 */
import type { AppLanguage } from "../lib/language";
import { getCurrentLanguage } from "./current";
import { interpolate } from "./translate";
import { apiErrorsKo, type ApiErrorCatalog } from "./locales/apiErrors.ko";
import { apiErrorsEn } from "./locales/apiErrors.en";

const CATALOGS: Record<AppLanguage, ApiErrorCatalog> = { ko: apiErrorsKo, en: apiErrorsEn };

export interface ServerProblem {
  code: string;
  details?: Record<string, unknown>;
}

function fill(message: string | undefined, details: Record<string, unknown> | undefined): string | null {
  if (!message) return null;
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (typeof v === "string" || typeof v === "number") vars[k] = v;
  }
  const text = interpolate(message, vars);
  return /\{\w+\}/.test(text) ? null : text;
}

/** The catalog's sentence for this problem, or null when it has none. */
export function apiErrorText(problem: ServerProblem, language: AppLanguage = getCurrentLanguage()): string | null {
  const catalog = CATALOGS[language];
  const reason = problem.details?.reason;
  const byReason =
    typeof reason === "string" ? (catalog.reasons as Record<string, string>)[reason] : undefined;
  return (
    fill(byReason, problem.details) ??
    fill((catalog.codes as Record<string, string>)[problem.code], problem.details)
  );
}
