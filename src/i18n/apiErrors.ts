/**
 * The apps' wording for a server error.
 *
 * The server's problem `detail` is English for developers and logs; members
 * and operators see the sentence the catalogs keep for the problem's
 * `details.reason` (when the server gives one) or else its `code`. `{name}`
 * slots are filled from `details` (a list is joined with commas); a sentence
 * whose slots `details` cannot fill is skipped rather than shown with a bare
 * `{name}`.
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
    else if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" || typeof x === "number")) {
      vars[k] = v.join(", ");
    }
  }
  const text = interpolate(message, vars);
  return /\{\w+\}/.test(text) ? null : text;
}

/** The catalogs' sentence for this problem, or null when none has one. */
export function apiErrorText(
  problem: ServerProblem,
  { language = getCurrentLanguage() }: { language?: AppLanguage } = {},
): string | null {
  const catalog: ApiErrorCatalog = CATALOGS[language];
  const reason = problem.details?.reason;
  const reasons: Record<string, string> = catalog.reasons;
  const codes: Record<string, string> = catalog.codes;
  const candidates = [typeof reason === "string" ? reasons[reason] : undefined, codes[problem.code]];
  for (const message of candidates) {
    const text = fill(message, problem.details);
    if (text) return text;
  }
  return null;
}
