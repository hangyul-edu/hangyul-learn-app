import { afterEach, expect, it, vi } from "vitest";
import { requestEasyPayBillingAuth, requestTossBillingAuth, resetTossSdkForTests } from "./tossPayments";

const opts = { clientKey: "ck", customerKey: "cu", successUrl: "/ok", failUrl: "/fail" };

// jsdom never fetches external scripts, so the load events are driven by hand.
function captureScripts(): HTMLScriptElement[] {
  const scripts: HTMLScriptElement[] = [];
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    scripts.push(node as HTMLScriptElement);
    return node;
  });
  return scripts;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.TossPayments;
  resetTossSdkForTests();
});

it("tries the SDK again after a load that did not define TossPayments", async () => {
  const scripts = captureScripts();

  const first = requestTossBillingAuth(opts);
  scripts[0].onload?.(new Event("load"));
  // Shown through errorMessage() as the translated network message.
  await expect(first).rejects.toThrow("httpError.network");

  const requestBillingAuth = vi.fn(async () => {});
  const second = requestTossBillingAuth(opts);
  expect(scripts).toHaveLength(2); // a fresh <script>, not the cached failure
  window.TossPayments = () => ({ payment: () => ({ requestBillingAuth }) });
  scripts[1].onload?.(new Event("load"));

  await expect(second).resolves.toBeUndefined();
  expect(requestBillingAuth).toHaveBeenCalledWith({
    method: "CARD",
    successUrl: "/ok",
    failUrl: "/fail",
    windowTarget: "self",
  });
});

it("opens the wallet window with SDK v1, flowMode DIRECT and the easyPay code", async () => {
  const scripts = captureScripts();
  const requestBillingAuth = vi.fn(async () => {});

  const opened = requestEasyPayBillingAuth({ ...opts, easyPay: "NAVERPAY" });
  expect(scripts[0].src).toBe("https://js.tosspayments.com/v1/payment");
  window.TossPayments = () => ({ requestBillingAuth });
  scripts[0].onload?.(new Event("load"));

  await expect(opened).resolves.toBeUndefined();
  expect(requestBillingAuth).toHaveBeenCalledWith("카드", {
    customerKey: "cu",
    successUrl: "/ok",
    failUrl: "/fail",
    flowMode: "DIRECT",
    easyPay: "NAVERPAY",
  });
});

it("keeps each SDK version's factory although both set the same global", async () => {
  const scripts = captureScripts();
  const v1Auth = vi.fn(async () => {});
  const v2Auth = vi.fn(async () => {});

  const wallet = requestEasyPayBillingAuth({ ...opts, easyPay: "TOSSPAY" });
  window.TossPayments = () => ({ requestBillingAuth: v1Auth });
  scripts[0].onload?.(new Event("load"));
  await wallet;

  const card = requestTossBillingAuth(opts);
  expect(scripts[1].src).toBe("https://js.tosspayments.com/v2/standard"); // not v1 reused
  window.TossPayments = () => ({ payment: () => ({ requestBillingAuth: v2Auth }) });
  scripts[1].onload?.(new Event("load"));
  await card;

  // The v1 global was overwritten, yet the wallet call still reaches v1.
  await requestEasyPayBillingAuth({ ...opts, easyPay: "TOSSPAY" });
  expect(v1Auth).toHaveBeenCalledTimes(2);
  expect(v2Auth).toHaveBeenCalledTimes(1);
});
