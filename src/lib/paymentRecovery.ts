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
import type { TranslationKey, Translate } from "../i18n";

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
    // The stored billing key could not be read: nothing was charged and the
    // method must be registered again — to the member, an unusable method.
    case "billing_key_unreadable":
      return "paymentRecovery.reasonMethodRevoked";
    case "provider_outage":
      return "paymentRecovery.reasonProviderOutage";
    case "currency_mismatch":
      return "paymentRecovery.reasonCurrencyMismatch";
    default:
      return "paymentRecovery.reasonGeneric";
  }
}

/**
 * Why a manual retry is refused right now (`retry_blocked_reason` on
 * GET /billing/recovery, `details.reason` on a refused POST …/retry). Each
 * charge is a real authorisation at the card company, so retries are spaced,
 * counted per day and capped per invoice.
 */
export type RetryBlockReason =
  | "paid"
  | "closed"
  | "obsolete"
  | "cancelled"
  | "in_progress"
  | "cooldown"
  | "daily_limit"
  | "attempt_cap"
  | "no_payment_method"
  | "method_unusable";

/** Sentence explaining a refused retry; cooldown/daily_limit take `{time}`. */
export function retryBlockedKey(reason?: string | null): TranslationKey {
  switch (reason) {
    case "cooldown":
      return "paymentRecovery.blockedCooldown";
    case "daily_limit":
      return "paymentRecovery.blockedDailyLimit";
    case "attempt_cap":
      return "paymentRecovery.blockedAttemptCap";
    case "in_progress":
      return "paymentRecovery.blockedInProgress";
    case "no_payment_method":
    case "method_unusable":
      return "paymentRecovery.blockedNeedsMethod";
    case "cancelled":
      return "paymentRecovery.blockedCancelled";
    default:
      return "paymentRecovery.blockedClosed";
  }
}

/** The refusal of a retry call, when the error is one: its reason and when a retry is allowed again. */
export function retryRefusal(error: unknown): { reason: string; retryAfter: string | null } | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { code?: unknown; details?: Record<string, unknown> };
  if (
    e.code !== "billing.retry_limit_reached" &&
    e.code !== "billing.retry_needs_new_method" &&
    e.code !== "billing.invoice_not_retryable"
  ) {
    return null;
  }
  const reason = typeof e.details?.reason === "string" ? e.details.reason : "closed";
  const retryAfter = typeof e.details?.retry_after === "string" ? e.details.retry_after : null;
  return { reason, retryAfter };
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
    case "billing_key_unreadable":
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
  t: Translate,
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
