import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../lib/http";

const { mine, plans, invoices, redeemCoupon } = vi.hoisted(() => ({
  mine: vi.fn(),
  plans: vi.fn(),
  invoices: vi.fn(),
  redeemCoupon: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, plans, redeemCoupon },
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

/** GET /subscriptions/me as the server sends it — no premium flag, no name. */
const sub = (status: string, over: Record<string, unknown> = {}) => ({
  subscription_id: "s1",
  plan_id: "p_year",
  status,
  current_period_end: "2026-10-10T00:00:00Z",
  cancel_at_period_end: false,
  coupon_backed: false,
  ...over,
});
const NO_SUB = sub("expired", { subscription_id: null, plan_id: null, current_period_end: null });

beforeEach(() => {
  vi.clearAllMocks();
  invoices.mockResolvedValue({ invoices: [], next_cursor: null });
  plans.mockResolvedValue({ plans: [{ plan_id: "p_year", name: "Annual" }] });
});

describe("Subscription — my plan", () => {
  it.each(["trial", "trial_ending", "active"])("offers 해지하기 for a %s subscription", async (status) => {
    // Regression: `trial_ending` (a trial in its last 72h) hid the button, so a
    // member could not cancel right before the first charge.
    mine.mockResolvedValue(sub(status));
    renderPage();
    expect(await screen.findByRole("button", { name: "해지하기" })).toBeInTheDocument();
  });

  it("names the plan from the plan list", async () => {
    // /subscriptions/me carries only plan_id; `plan_name` was never sent.
    mine.mockResolvedValue(sub("active"));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
  });

  it("shows a coupon-backed pass as a plan, not as no subscription", async () => {
    mine.mockResolvedValue(sub("expired", { coupon_backed: true }));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
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
