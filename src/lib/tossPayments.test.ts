import { afterEach, expect, it, vi } from "vitest";
import { requestTossBillingAuth } from "./tossPayments";

const opts = { clientKey: "ck", customerKey: "cu", successUrl: "/ok", failUrl: "/fail" };

afterEach(() => {
  vi.restoreAllMocks();
  delete window.TossPayments;
});

it("tries the SDK again after a load that did not define TossPayments", async () => {
  // jsdom never fetches external scripts, so drive the load events by hand.
  const scripts: HTMLScriptElement[] = [];
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    scripts.push(node as HTMLScriptElement);
    return node;
  });

  const first = requestTossBillingAuth(opts);
  scripts[0].onload?.(new Event("load"));
  await expect(first).rejects.toThrow("Toss SDK unavailable");

  const requestBillingAuth = vi.fn(async () => {});
  const second = requestTossBillingAuth(opts);
  expect(scripts).toHaveLength(2); // a fresh <script>, not the cached failure
  window.TossPayments = (() => ({
    payment: () => ({ requestBillingAuth }),
    brandpay: () => ({ addPaymentMethod: async () => {}, requestBillingAuth: async () => {} }),
  })) as unknown as typeof window.TossPayments;
  scripts[1].onload?.(new Event("load"));

  await expect(second).resolves.toBeUndefined();
  expect(requestBillingAuth).toHaveBeenCalledTimes(1);
});
