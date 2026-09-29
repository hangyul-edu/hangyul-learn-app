/**
 * Toss Payments JS SDK (v2) — card-registration window for 자동결제, and
 * BrandPay (Toss Pay) registration (see `requestBrandpayRegistration`).
 *
 * Toss has no server-generated registration URL for card billing: the page
 * loads the SDK and calls
 * `TossPayments(clientKey).payment({ customerKey }).requestBillingAuth(...)`.
 * Toss then redirects to `successUrl?customerKey=…&authKey=…` or
 * `failUrl?code=…&message=…`.
 * https://docs.tosspayments.com/guides/v2/billing/integration
 * https://docs.tosspayments.com/sdk/v2/js/payment#paymentrequestbillingauth
 */

const SDK_URL = "https://js.tosspayments.com/v2/standard";

type BillingAuthRequest = {
  method: "CARD";
  successUrl: string;
  failUrl: string;
  /** `self` navigates this tab (the SDK defaults to an iframe on desktop). */
  windowTarget?: "self" | "iframe";
};
type TossPaymentsFactory = (clientKey: string) => {
  payment: (opts: { customerKey: string }) => {
    requestBillingAuth: (req: BillingAuthRequest) => Promise<void>;
  };
  brandpay: (opts: { customerKey: string; redirectUrl: string }) => {
    addPaymentMethod: () => Promise<void>;
    requestBillingAuth: () => Promise<void>;
  };
};

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

let loading: Promise<TossPaymentsFactory> | null = null;

function loadSdk(): Promise<TossPaymentsFactory> {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (loading) return loading;
  loading = new Promise<TossPaymentsFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    // A failed load must not be cached: the next attempt starts over.
    const fail = (message: string) => {
      loading = null;
      reject(new Error(message));
    };
    script.onload = () =>
      window.TossPayments ? resolve(window.TossPayments) : fail("Toss SDK unavailable");
    script.onerror = () => fail("Toss SDK failed to load");
    document.head.appendChild(script);
  });
  return loading;
}

/** Open Toss's card-registration window; the page navigates away on success. */
export async function requestTossBillingAuth(opts: {
  clientKey: string;
  customerKey: string;
  successUrl: string;
  failUrl: string;
}): Promise<void> {
  const TossPayments = await loadSdk();
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
 * Register a BrandPay (Toss Pay) method for 자동결제: add a card or account,
 * then take the 자동결제 agreement + password. Both are promises — no page
 * redirect. On the customer's consent the SDK calls `redirectUrl` (our API),
 * which exchanges the authorization code before the SDK continues.
 * https://docs.tosspayments.com/sdk/v2/js/brandpay
 * https://docs.tosspayments.com/reference/brandpay/billing
 *
 * Rejects with the SDK's error (`code === "USER_CANCEL"` when the member
 * closes the window).
 */
export async function requestBrandpayRegistration(opts: {
  clientKey: string;
  customerKey: string;
  redirectUrl: string;
}): Promise<void> {
  const TossPayments = await loadSdk();
  const brandpay = TossPayments(opts.clientKey).brandpay({
    customerKey: opts.customerKey,
    redirectUrl: opts.redirectUrl,
  });
  await brandpay.addPaymentMethod();
  await brandpay.requestBillingAuth();
}

/** The member closed a Toss window themselves — not an error to report. */
export function isUserCancel(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "USER_CANCEL" || code === "PAY_PROCESS_CANCELED";
}
