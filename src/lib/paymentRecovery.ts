/**
 * Copy selection + formatting for the failed-automatic-payment recovery flow.
 *
 * The backend returns stable failure *codes* only (never raw provider
 * messages). This module maps a code to the catalog key that describes it, so
 * the wording itself lives with the rest of the copy and follows the app
 * language; keeping the mapping here (not in the backend) lets copy change
 * without an API change.
 */
import type { AppLanguage } from "./language";
import { localeFor } from "./format";
import type { TranslationKey } from "../i18n";

/** Notice-card sentence describing why the automatic payment failed (§3). */
export function noticeReasonKey(failureClass?: string | null): TranslationKey {
  switch (failureClass) {
    case "insufficient_funds":
      return "paymentRecovery.reasonInsufficientFunds";
    case "card_expired":
      return "paymentRecovery.reasonCardExpired";
    case "declined_generic":
      return "paymentRecovery.reasonDeclined";
    case "method_revoked":
      return "paymentRecovery.reasonMethodRevoked";
    case "provider_outage":
      return "paymentRecovery.reasonProviderOutage";
    case "currency_mismatch":
      return "paymentRecovery.reasonCurrencyMismatch";
    default:
      return "paymentRecovery.reasonGeneric";
  }
}

/** Guidance appended after the failure reason in the notice card. */
export const NOTICE_GUIDANCE_KEY: TranslationKey = "paymentRecovery.noticeGuidance";

/** Two-line failure-modal copy, adjusted per reason (§9). */
export function failureModalKeys(failureClass?: string | null): [TranslationKey, TranslationKey] {
  switch (failureClass) {
    case "insufficient_funds":
      return ["paymentRecovery.failInsufficientTitle", "paymentRecovery.failInsufficientSub"];
    case "card_expired":
    case "method_revoked":
      return ["paymentRecovery.failUnusableTitle", "paymentRecovery.failUnusableSub"];
    case "provider_outage":
      return ["paymentRecovery.failTemporaryTitle", "paymentRecovery.failTemporarySub"];
    case "currency_mismatch":
      return ["paymentRecovery.failCurrencyTitle", "paymentRecovery.failCurrencySub"];
    default:
      return ["paymentRecovery.failGenericTitle", "paymentRecovery.failGenericSub"];
  }
}

/**
 * Format the next automatic retry timestamp in the user's locale/timezone
 * (§14): a relative today/tomorrow, month·day for later dates, and the year
 * when it differs. Returns "" for a missing/invalid value so callers can omit
 * the row.
 *
 * `t` supplies the relative-day wording, which is not derivable from Intl.
 */
export function formatRetryAt(
  iso: string | null | undefined,
  language: AppLanguage,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  now: Date = new Date(),
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = localeFor(language);
  const time = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const dayDelta = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (dayDelta === 0) return t("paymentRecovery.today", { time });
  if (dayDelta === 1) return t("paymentRecovery.tomorrow", { time });
  const datePart = new Intl.DateTimeFormat(locale, {
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
  }).format(d);
  return `${datePart} ${time}`;
}
