/**
 * The apps' wording for a server error.
 *
 * The server's problem `detail` is English for developers and logs; members
 * and operators see the sentence the catalogs keep for the problem's
 * `details.reason` (when the server gives one) or else its `code`. `{name}`
 * slots are filled from `details` (a list is joined with commas); a sentence
 * whose slots `details` cannot fill is skipped rather than shown with a bare
 * `{name}`.
 *
 * The admin portal (Korean only) looks in its own catalog first, then in the
 * Korean member catalog: reasons before codes in both.
 */
import type { AppLanguage } from "../lib/language";
import { getCurrentLanguage } from "./current";
import { interpolate } from "./translate";
import { apiErrorsKo, type ApiErrorCatalog } from "./locales/apiErrors.ko";
import { apiErrorsEn } from "./locales/apiErrors.en";
import { apiErrorsAdminKo } from "./locales/apiErrors.admin.ko";

const CATALOGS: Record<AppLanguage, ApiErrorCatalog> = { ko: apiErrorsKo, en: apiErrorsEn };

export interface ServerProblem {
  code: string;
  details?: Record<string, unknown>;
}

/** Who reads the message: a member (in the app language) or an operator. */
export type ErrorAudience = "member" | "admin";

interface Catalog {
  codes: Record<string, string>;
  reasons: Record<string, string>;
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
  { audience = "member", language = getCurrentLanguage() }: { audience?: ErrorAudience; language?: AppLanguage } = {},
): string | null {
  const catalogs: Catalog[] =
    audience === "admin" ? [apiErrorsAdminKo, apiErrorsKo] : [CATALOGS[language]];
  const reason = problem.details?.reason;
  const candidates = [
    ...(typeof reason === "string" ? catalogs.map((c) => c.reasons[reason]) : []),
    ...catalogs.map((c) => c.codes[problem.code]),
  ];
  for (const message of candidates) {
    const text = fill(message, problem.details);
    if (text) return text;
  }
  return null;
}
