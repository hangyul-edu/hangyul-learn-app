/**
 * Friendly copy for payment-method error codes (docs/payments/07-rest-api.md,
 * the RFC 7807 `code` of each problem).
 *
 * Only the stable `code` and the server's `details` are read — never the
 * request that caused the error (it may have carried a card number).
 */
import { tCurrent } from "../i18n/current";
import type { TranslationKey } from "../i18n";
import { ApiError, NetworkError, errorMessage } from "./http";
import type { CardField } from "./cardInput";

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;
const tNow: Translate = (key, vars) => tCurrent(key, vars);

/** "원화(KRW)" / "US dollars (USD)" for the currencies we name; the bare code otherwise. */
export function currencyLabel(code: string | null | undefined, t: Translate = tNow): string {
  const c = (code ?? "").toUpperCase();
  switch (c) {
    case "KRW":
      return t("paymentMethods.currencyName.KRW");
    case "USD":
      return t("paymentMethods.currencyName.USD");
    case "JPY":
      return t("paymentMethods.currencyName.JPY");
    default:
      return c;
  }
}

function detailString(e: ApiError, key: string): string | null {
  const v = e.details?.[key];
  return typeof v === "string" && v ? v.toUpperCase() : null;
}

/**
 * `subscription.currency_mismatch` (subscribe / trial / change plan) and
 * `payment_method.currency_mismatch` (set default / replace / register): the
 * card can only be charged in one currency and the plan is priced in another.
 * Returns null for any other error.
 */
export function currencyMismatchMessage(e: unknown, t: Translate = tNow): string | null {
  if (!(e instanceof ApiError)) return null;
  if (e.code !== "subscription.currency_mismatch" && e.code !== "payment_method.currency_mismatch") return null;
  return currencyMismatchText(
    detailString(e, "card_currency"),
    detailString(e, "plan_currency") ?? detailString(e, "subscription_currency"),
    t,
  );
}

/** "This card is charged only in X; the plan is billed in Y" — also used before calling the API. */
export function currencyMismatchText(
  cardCurrency: string | null | undefined,
  planCurrency: string | null | undefined,
  t: Translate = tNow,
): string {
  const card = cardCurrency?.toUpperCase();
  const plan = planCurrency?.toUpperCase();
  if (!card || !plan) return t("paymentMethods.currencyMismatchGeneric");
  // A Korean card (KRW) facing a foreign-currency plan: point at the overseas-card flow.
  if (card === "KRW") {
    return t("paymentMethods.currencyMismatchKrwCard", { plan: currencyLabel(plan, t) });
  }
  return t("paymentMethods.currencyMismatch", { card: currencyLabel(card, t), plan: currencyLabel(plan, t) });
}

/** `errorMessage()` plus the payment codes that need their own wording. */
export function paymentErrorMessage(e: unknown, t: Translate = tNow): string {
  return currencyMismatchMessage(e, t) ?? errorMessage(e);
}

/* ------------------- overseas-card registration errors ------------------- */

export type IntlCardErrorKind =
  /** Show the form-level message; the card was not registered. */
  | "message"
  /** International cards are off: swap the form for the "not available" state. */
  | "unavailable"
  /** The offered currencies changed: re-fetch the options. */
  | "currencies_changed";

export interface IntlCardError {
  kind: IntlCardErrorKind;
  message: string;
  /** Field to highlight, when the error is about one. */
  field?: CardField;
  /** The outcome is unknown (network / 502): a retry must reuse the same idempotency key. */
  retrySameKey: boolean;
  /** A currency the server says would work (currency mismatch / unsupported). */
  suggestCurrency?: string;
}

const FIELD_BY_LOC: Record<string, CardField> = {
  card_number: "cardNumber",
  expiry_month: "expiry",
  expiry_year: "expiry",
  holder_birth_date: "birthDate",
  currency: "currency",
};

const FIELD_MESSAGE: Record<CardField, TranslationKey> = {
  cardNumber: "paymentMethods.intl.errors.invalidCardNumber",
  expiry: "paymentMethods.intl.errors.invalidExpiry",
  birthDate: "paymentMethods.intl.errors.invalidHolder",
  currency: "paymentMethods.intl.errors.unsupportedCurrency",
};

/** Map a failed `POST /payment-methods/cards/international` to what the form shows. */
export function intlCardError(e: unknown, t: Translate = tNow): IntlCardError {
  const msg = (key: TranslationKey, vars?: Record<string, string | number>) => t(key, vars);
  if (e instanceof NetworkError) {
    return { kind: "message", message: msg("paymentMethods.intl.errors.providerUnavailable"), retrySameKey: true };
  }
  if (!(e instanceof ApiError)) {
    return { kind: "message", message: msg("paymentMethods.intl.errors.generic"), retrySameKey: false };
  }
  const base = { kind: "message" as const, retrySameKey: false };
  switch (e.code) {
    case "validation_error": {
      // An expired card: {"loc": ["body","expiry_year"], "type": "card_expired"}.
      if (e.fieldErrors?.some((f) => f.type === "card_expired")) {
        return { ...base, field: "expiry", message: msg("paymentMethods.intl.errors.expiryExpired") };
      }
      const fieldErr = e.fieldErrors?.find((f) => typeof f.loc[1] === "string" && FIELD_BY_LOC[f.loc[1] as string]);
      if (fieldErr) {
        const field = FIELD_BY_LOC[fieldErr.loc[1] as string];
        return { ...base, field, message: msg(FIELD_MESSAGE[field]) };
      }
      return { ...base, message: msg("paymentMethods.intl.errors.generic") };
    }
    case "payment_method.invalid_card_number":
      return { ...base, field: "cardNumber", message: msg("paymentMethods.intl.errors.invalidCardNumber") };
    case "payment_method.invalid_card_expiry":
      return { ...base, field: "expiry", message: msg("paymentMethods.intl.errors.invalidExpiry") };
    case "payment_method.invalid_card_holder":
      return { ...base, field: "birthDate", message: msg("paymentMethods.intl.errors.invalidHolder") };
    case "payment_method.card_not_supported":
      return { ...base, message: msg("paymentMethods.intl.errors.cardNotSupported") };
    case "payment_method.card_declined":
      return { ...base, message: msg("paymentMethods.intl.errors.declined") };
    case "payment_method.unsupported_currency": {
      const available = e.details?.available_currencies;
      const first = Array.isArray(available) && typeof available[0] === "string" ? available[0] : undefined;
      return {
        ...base,
        kind: "currencies_changed",
        field: "currency",
        suggestCurrency: first,
        message: msg("paymentMethods.intl.errors.unsupportedCurrency"),
      };
    }
    case "payment_method.currency_mismatch": {
      const sub = detailString(e, "subscription_currency");
      return {
        ...base,
        field: "currency",
        suggestCurrency: sub ?? undefined,
        message: sub
          ? msg("paymentMethods.intl.errors.currencyMismatch", { currency: currencyLabel(sub, t) })
          : msg("paymentMethods.currencyMismatchGeneric"),
      };
    }
    case "payment_method.invalid_intent_state":
      return { ...base, message: msg("paymentMethods.intl.errors.retryFresh") };
    case "payment_method.provider_unavailable":
      return { ...base, retrySameKey: true, message: msg("paymentMethods.intl.errors.providerUnavailable") };
    case "payment_method.provider_not_configured":
      return { ...base, kind: "unavailable", message: msg("paymentMethods.intl.unavailableTitle") };
    case "rate_limited":
      return { ...base, message: msg("paymentMethods.intl.errors.rateLimited") };
    default:
      if (e.status === 429) return { ...base, message: msg("paymentMethods.intl.errors.rateLimited") };
      // A bare 502/504 (e.g. from a gateway) leaves the outcome undecided, like provider_unavailable.
      if (e.status === 502 || e.status === 504) {
        return { ...base, retrySameKey: true, message: msg("paymentMethods.intl.errors.providerUnavailable") };
      }
      return { ...base, message: msg("paymentMethods.intl.errors.generic") };
  }
}
