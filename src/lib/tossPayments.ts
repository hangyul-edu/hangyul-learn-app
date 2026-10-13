/**
 * Toss Payments JS SDK — the registration windows for 자동결제 (billing).
 *
 * Toss has no server-generated registration URL: the page loads the SDK,
 * opens the window, and Toss redirects back to `successUrl?customerKey=…&
 * authKey=…` or `failUrl?code=…&message=…`, after which the server exchanges
 * the `authKey` for a billing key.
 *
 * - Korean-issued cards — SDK v2 (`https://js.tosspayments.com/v2/standard`):
 *   `TossPayments(clientKey).payment({ customerKey }).requestBillingAuth(
 *   { method: "CARD", successUrl, failUrl })`
 *   (https://docs.tosspayments.com/guides/v2/billing/integration).
 * - Toss Pay / Naver Pay — SDK v1 (`https://js.tosspayments.com/v1/payment`),
 *   the call both wallet guides document
 *   (docs/payments/Toss Pay Billing.md, Naver Pay Billing.md):
 *   `TossPayments(clientKey).requestBillingAuth('카드', { customerKey,
 *   successUrl, failUrl, flowMode: 'DIRECT', easyPay: 'TOSSPAY' | 'NAVERPAY' })`,
 *   which opens the wallet's own window.
 *
 * Both SDKs define the same global `TossPayments`, so each version's factory
 * is captured right after its own script loads and kept apart from the other.
 */

const SDK_V2 = "https://js.tosspayments.com/v2/standard";
const SDK_V1 = "https://js.tosspayments.com/v1/payment";

type BillingAuthRequest = {
  method: "CARD";
  successUrl: string;
  failUrl: string;
  /** `self` navigates this tab (the SDK defaults to an iframe on desktop). */
  windowTarget?: "self" | "iframe";
};
type TossPaymentsV2 = (clientKey: string) => {
  payment: (opts: { customerKey: string }) => {
    requestBillingAuth: (req: BillingAuthRequest) => Promise<void>;
  };
};
type EasyPayBillingAuthRequest = {
  customerKey: string;
  successUrl: string;
  failUrl: string;
  flowMode: "DIRECT";
  easyPay: "TOSSPAY" | "NAVERPAY";
};
type TossPaymentsV1 = (clientKey: string) => {
  requestBillingAuth: (method: "카드", req: EasyPayBillingAuthRequest) => Promise<void>;
};

declare global {
  interface Window {
    TossPayments?: unknown;
  }
}

const loading = new Map<string, Promise<unknown>>();

function loadSdk<T>(src: string): Promise<T> {
  const cached = loading.get(src);
  if (cached) return cached as Promise<T>;
  const promise = new Promise<T>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    // A failed load must not be cached: the next attempt starts over.
    // A message key, not English: errorMessage() shows it in the app's
    // language (the payment window could not be reached).
    const fail = () => {
      loading.delete(src);
      reject(new Error("httpError.network"));
    };
    script.onload = () => {
      // Read at once: the other SDK version may overwrite the global later.
      const factory = window.TossPayments;
      if (typeof factory === "function") resolve(factory as T);
      else fail();
    };
    script.onerror = () => fail();
    document.head.appendChild(script);
  });
  loading.set(src, promise);
  return promise;
}

/** Open Toss's card-registration window; the page navigates away on success. */
export async function requestTossBillingAuth(opts: {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}): Promise<void> {
  const TossPayments = await loadSdk<TossPaymentsV2>(SDK_V2);
  await TossPayments(opts.clientKey)
    .payment({ customerKey: opts.customerKey })
    .requestBillingAuth({
      method: "CARD",
      successUrl: opts.successUrl,
      failUrl: opts.failUrl,
      // The return is handled by this page (see paymentReturn.ts), so the
      // window replaces it rather than opening in an iframe.
      windowTarget: "self",
    });
}

/**
 * Open the Toss Pay or Naver Pay window to register the wallet for 자동결제.
 * The member picks a card or account (Toss Pay) / card or Naver Pay money
 * (Naver Pay) there; the page then navigates to `successUrl` / `failUrl`.
 */
export async function requestEasyPayBillingAuth(opts: {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
  easyPay: "TOSSPAY" | "NAVERPAY";
}): Promise<void> {
  const TossPayments = await loadSdk<TossPaymentsV1>(SDK_V1);
  await TossPayments(opts.clientKey).requestBillingAuth("카드", {
    customerKey: opts.customerKey,
    successUrl: opts.successUrl,
    failUrl: opts.failUrl,
    flowMode: "DIRECT",
    easyPay: opts.easyPay,
  });
}

/** Forget loaded SDKs (tests only). */
export function resetTossSdkForTests(): void {
  loading.clear();
}

/** The member closed a Toss window themselves — not an error to report. */
export function isUserCancel(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED";
}
