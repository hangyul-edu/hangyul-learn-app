/**
 * Coming back from a provider's registration window.
 *
 * Before leaving for the window the wallet saves which provider and intent
 * it opened; the provider then redirects back to `/account/payment` with its
 * own query parameters, which say how it went:
 *
 * - Toss card: `?customerKey=…&authKey=…`, or `?code=…&message=…` on failure
 *   (https://docs.tosspayments.com/guides/v2/billing/integration).
 * - Naver Pay: `?resultCode=Success&reserveId=…&tempReceiptId=…`, otherwise
 *   `resultCode` + `resultMessage`
 *   (https://docs.pay.naver.com/docs/more-information/non-sdk-integration/recurrent-payment-auth-window).
 *
 * Toss Pay (BrandPay) never navigates away: its SDK calls resolve in place.
 */
import type { MethodProvider } from "./types";

const KEY = "hangyul.pm-registration.v1";

export type PendingRegistration = { provider: MethodProvider; intentId: string };

export function savePendingRegistration(pending: PendingRegistration): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    /* storage unavailable: the manual entry in the sheet still works */
  }
}

/** Read and forget the saved registration (one return per window). */
export function takePendingRegistration(): PendingRegistration | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingRegistration;
    return p && typeof p.intentId === "string" && typeof p.provider === "string" ? p : null;
  } catch {
    return null;
  }
}

export type RegistrationReturn =
  | { kind: "toss_card"; authKey: string }
  | { kind: "naver_pay"; reserveId: string; tempReceiptId: string }
  | { kind: "failed"; message: string | null };

/** Query parameters the providers add; stripped from the URL once handled. */
export const RETURN_PARAMS = [
  "authKey",
  "customerKey",
  "code",
  "message",
  "resultCode",
  "resultMessage",
  "reserveId",
  "tempReceiptId",
  "recurrentId",
] as const;

/** Whether the query looks like any provider's return. */
export function hasReturnParams(search: string): boolean {
  const q = new URLSearchParams(search);
  return RETURN_PARAMS.some((name) => q.has(name));
}

/** What `provider`'s return query says, or null when it is not its return. */
export function parseRegistrationReturn(
  provider: MethodProvider,
  search: string,
): RegistrationReturn | null {
  const q = new URLSearchParams(search);
  const get = (name: string) => q.get(name) || null;
  if (provider === "toss_card") {
    const authKey = get("authKey");
    if (authKey) return { kind: "toss_card", authKey };
    if (get("code")) return { kind: "failed", message: get("message") };
    return null;
  }
  if (provider === "naver_pay") {
    const resultCode = get("resultCode");
    if (!resultCode) return null;
    const reserveId = get("reserveId");
    const tempReceiptId = get("tempReceiptId");
    if (resultCode === "Success" && reserveId && tempReceiptId) {
      return { kind: "naver_pay", reserveId, tempReceiptId };
    }
    return { kind: "failed", message: get("resultMessage") };
  }
  return null;
}

/**
 * Naver's two values from what a user pastes by hand: the whole return
 * address, its query, or `reserveId tempReceiptId`.
 */
export function naverValuesFromText(text: string): { reserveId: string; tempReceiptId: string } | null {
  const trimmed = text.trim();
  const query = trimmed.includes("?") ? trimmed.slice(trimmed.indexOf("?") + 1) : trimmed;
  const q = new URLSearchParams(query);
  const reserveId = q.get("reserveId");
  const tempReceiptId = q.get("tempReceiptId");
  if (reserveId && tempReceiptId) return { reserveId, tempReceiptId };
  const parts = trimmed.split(/[\s,]+/).filter(Boolean);
  if (parts.length === 2 && !trimmed.includes("=")) {
    return { reserveId: parts[0], tempReceiptId: parts[1] };
  }
  return null;
}
