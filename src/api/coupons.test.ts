import { afterEach, expect, it, vi } from "vitest";
import { subApi } from "./endpoints";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("redeems a coupon with a single POST to /subscriptions/coupons/redeem", async () => {
  // The server exposes only this route (src/modules/coupons/presentation/router.py);
  // there is no separate validate/apply step.
  const fetchMock = vi.fn(async () => ({
    status: 201,
    ok: true,
    text: async () => JSON.stringify({ coupon_id: "c1", activated: true }),
  }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(subApi.redeemCoupon("ABCD-1234-EFGH")).resolves.toMatchObject({ coupon_id: "c1" });

  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(new URL(url).pathname).toMatch(/\/subscriptions\/coupons\/redeem$/);
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ code: "ABCD-1234-EFGH" });
});
