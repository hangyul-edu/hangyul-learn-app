/**
 * Coming back from a Toss registration window (card, Toss Pay, Naver Pay).
 *
 * Before leaving for the window the wallet saves which provider and intent it
 * opened, and the `customerKey` it opened the window with; Toss then
 * redirects back to `/account/payment` with
 * `?customerKey=…&authKey=…` on success or `?code=…&message=…` on failure
 * (https://docs.tosspayments.com/guides/v2/billing/integration;
 * docs/payments/Toss Pay Billing.md, Naver Pay Billing.md). Toss asks
 * merchants to check that the returned `customerKey` is the one they sent.
 */
import type { MethodProvider } from "./types";

const KEY = "hangyul.pm-registration.v2";

export type PendingRegistration = { provider: MethodProvider; intentId: string; customerKey: string };

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
    return p &&
      typeof p.intentId === "string" &&
      typeof p.provider === "string" &&
      typeof p.customerKey === "string"
      ? p
      : null;
  } catch {
    return null;
  }
}

export type RegistrationReturn =
  | { kind: "authorized"; authKey: string; customerKey: string }
  | { kind: "failed"; code: string | null; message: string | null };

/** Query parameters Toss adds; stripped from the URL once handled. */
export const RETURN_PARAMS = ["authKey", "customerKey", "code", "message"] as const;

/** Whether the query looks like a Toss window's return. */
export function hasReturnParams(search: string): boolean {
  const q = new URLSearchParams(search);
  return RETURN_PARAMS.some((name) => q.has(name));
}

/**
 * What the return query says for the registration `pending` opened, or null
 * when it is not a window's return. A `customerKey` other than the one the
 * window was opened with is refused (a mixed-up tab or a tampered redirect).
 */
export function parseRegistrationReturn(
  pending: PendingRegistration,
  search: string,
): RegistrationReturn | null {
  const q = new URLSearchParams(search);
  const get = (name: string) => q.get(name) || null;
  const authKey = get("authKey");
  if (authKey) {
    const customerKey = get("customerKey");
    if (customerKey !== pending.customerKey) {
      return { kind: "failed", code: "CUSTOMER_KEY_MISMATCH", message: null };
    }
    return { kind: "authorized", authKey, customerKey };
  }
  if (get("code")) return { kind: "failed", code: get("code"), message: get("message") };
  return null;
}
