import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../lib/http";

const { mine, invoices, redeemCoupon, billingCountry, setBillingCountry } = vi.hoisted(() => ({
  mine: vi.fn(),
  invoices: vi.fn(),
  redeemCoupon: vi.fn(),
  billingCountry: vi.fn(),
  setBillingCountry: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, redeemCoupon, billingCountry, setBillingCountry },
  billingApi: { invoices },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { Subscription } from "./Subscription";
import { I18nProvider } from "../i18n";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/subscription"]}>
          <Subscription />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

/** GET /subscriptions/me as the server sends it — no premium flag. */
const sub = (status: string, over: Record<string, unknown> = {}) => ({
  subscription_id: "s1",
  plan_id: "p_year",
  plan_name: "Annual",
  status,
  current_period_end: "2026-10-10T00:00:00Z",
  cancel_at_period_end: false,
  coupon_backed: false,
  ...over,
});
const NO_SUB = sub("expired", { subscription_id: null, plan_id: null, current_period_end: null });

const US_CONFIRMED = {
  billing_country: { country: "US", source: "confirmed", confirmed: true, currency: "USD" },
  subscription: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  invoices.mockResolvedValue({ invoices: [], next_cursor: null });
  billingCountry.mockResolvedValue(US_CONFIRMED);
});

describe("Subscription — billing currency and country", () => {
  it("shows the renewal price in the subscription's own currency", async () => {
    mine.mockResolvedValue(sub("active", { interval: "year", plan_currency: "USD", renewal_amount_cents: 7188 }));
    renderPage();
    expect(await screen.findByText("US$71.88/년")).toBeInTheDocument();
    expect(screen.getByText("갱신 금액")).toBeInTheDocument();
  });

  it("shows the billing country with its currency", async () => {
    mine.mockResolvedValue(sub("active"));
    renderPage();
    const row = await screen.findByTestId("billing-country-row");
    expect(row).toHaveTextContent("결제 국가: 미국 (USD)");
  });

  it("explains that a running subscription stays as it is and changes the country only on a yes", async () => {
    mine.mockResolvedValue(sub("active", { interval: "year", plan_currency: "USD", renewal_amount_cents: 7188 }));
    setBillingCountry.mockImplementation(async (_country: string, acknowledge: boolean) => {
      if (!acknowledge) {
        throw new ApiError(409, "billing_country.confirmation_required", "x", {
          country: "KR",
          new_currency: "KRW",
          subscription_currency: "USD",
          renewal_amount_cents: 7188,
          next_billing_at: "2027-10-13T00:00:00Z",
        });
      }
      return {
        billing_country: { country: "KR", source: "confirmed", confirmed: true, currency: "KRW" },
        subscription: { plan_id: "p_year", currency: "USD", renewal_amount_cents: 7188, next_billing_at: null },
      };
    });
    renderPage();
    const row = await screen.findByTestId("billing-country-row");
    await userEvent.click(within(row).getByRole("button", { name: "변경" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "국가 검색" }), "대한민국");
    await userEvent.click(screen.getByRole("button", { name: /대한민국/ }));
    await userEvent.click(screen.getByRole("button", { name: "이 국가로 결제" }));

    // Refused until the member acknowledges: the dialog says what stays.
    expect(await screen.findByText("현재 구독은 그대로 유지돼요")).toBeInTheDocument();
    expect(screen.getByText(/대한민국의 결제 통화는 원화\(KRW\)예요\./)).toBeInTheDocument();
    expect(screen.getByText(/미국 달러\(USD\)로 유지되며, 다음 결제일\(2027년 10월 13일\)에 US\$71\.88이\(가\) 그대로 청구돼요/)).toBeInTheDocument();
    expect(setBillingCountry).toHaveBeenCalledTimes(1);
    expect(setBillingCountry).toHaveBeenLastCalledWith("KR", false);

    await userEvent.click(screen.getByRole("button", { name: "네, 변경할게요" }));
    await waitFor(() => expect(setBillingCountry).toHaveBeenLastCalledWith("KR", true));
    await waitFor(() => expect(screen.queryByText("현재 구독은 그대로 유지돼요")).not.toBeInTheDocument());
  });

  it("cancelling the explanation leaves the country as it was", async () => {
    mine.mockResolvedValue(sub("active", { interval: "month", plan_currency: "USD", renewal_amount_cents: 999 }));
    setBillingCountry.mockRejectedValue(
      new ApiError(409, "billing_country.confirmation_required", "x", {
        country: "KR", new_currency: "KRW", subscription_currency: "USD", renewal_amount_cents: 999, next_billing_at: null,
      }),
    );
    renderPage();
    await userEvent.click(within(await screen.findByTestId("billing-country-row")).getByRole("button", { name: "변경" }));
    await userEvent.click(screen.getAllByRole("button", { name: /대한민국/ })[0]);
    await userEvent.click(screen.getByRole("button", { name: "이 국가로 결제" }));
    await screen.findByText("현재 구독은 그대로 유지돼요");
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(setBillingCountry).toHaveBeenCalledTimes(1);
    expect(setBillingCountry).not.toHaveBeenCalledWith("KR", true);
  });
});

describe("Subscription — my plan", () => {
  it.each(["trial", "trial_ending", "active"])("offers 해지하기 for a %s subscription", async (status) => {
    // Regression: `trial_ending` (a trial in its last 72h) hid the button, so a
    // member could not cancel right before the first charge.
    mine.mockResolvedValue(sub(status));
    renderPage();
    expect(await screen.findByRole("button", { name: "해지하기" })).toBeInTheDocument();
  });

  it("names the plan in force, older plans included", async () => {
    // The name comes with /subscriptions/me: an older plan that only renews
    // is not in the public plan list, so looking it up there showed the fallback.
    mine.mockResolvedValue(sub("active", { plan_id: "plan_monthly_2025", plan_name: "Monthly (2025)" }));
    renderPage();
    expect(await screen.findByText("Monthly (2025)")).toBeInTheDocument();
  });

  it("shows a coupon-backed pass as a plan, not as no subscription", async () => {
    // A coupon period has no plan behind it.
    mine.mockResolvedValue(sub("expired", { coupon_backed: true, plan_id: null, plan_name: null }));
    renderPage();
    expect(await screen.findByText("프리미엄")).toBeInTheDocument();
  });

  it("hides 해지하기 once a cancellation is already scheduled", async () => {
    mine.mockResolvedValue(sub("active", { cancel_at_period_end: true }));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해지하기" })).not.toBeInTheDocument();
  });
});

describe("Subscription — coupon redemption", () => {
  async function submitCode(code: string) {
    await userEvent.click(await screen.findByRole("button", { name: "등록하기" }));
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: code } });
    const dialog = await screen.findByRole("dialog");
    const submit = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent?.includes("등록"));
    await userEvent.click(submit!);
  }

  it("redeems through the single redeem endpoint and shows the grant", async () => {
    // Regression: the screen called /coupons/validate and /coupons/apply,
    // which do not exist — every code, valid or not, ended in the failure modal.
    mine.mockResolvedValue(NO_SUB);
    redeemCoupon.mockResolvedValue({
      coupon_id: "c1",
      code: "ABCD-1234-EFGH",
      plan_name: "수강권 30일",
      subscription_type: "course_pass_coupon",
      duration_days: 30,
      activated: true,
      queue_position: 0,
      effective_start_at: "2026-09-01T00:00:00Z",
      effective_end_at: "2026-10-01T00:00:00Z",
    });
    renderPage();
    await submitCode("ABCD-1234-EFGH");
    await waitFor(() => expect(redeemCoupon).toHaveBeenCalledWith("ABCD-1234-EFGH"));
    expect(await screen.findByText("2026.09.01~2026.10.01")).toBeInTheDocument();
  });

  it("keeps the code entry open (not 'invalid code') when the attempt cap is hit", async () => {
    mine.mockResolvedValue(NO_SUB);
    redeemCoupon.mockRejectedValue(new ApiError(429, "rate_limited", "잠시 후 다시 시도해 주세요."));
    renderPage();
    await submitCode("ABCD-1234-EFGH");
    await waitFor(() => expect(redeemCoupon).toHaveBeenCalled());
    expect(await screen.findByText("잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
  });
});
