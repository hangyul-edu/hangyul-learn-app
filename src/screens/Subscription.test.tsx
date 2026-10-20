import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "../lib/http";

const { mine, invoices, redeemCoupon, cancel, bootstrapMe } = vi.hoisted(() => ({
  bootstrapMe: vi.fn(async () => ({})),
  mine: vi.fn(),
  invoices: vi.fn(),
  redeemCoupon: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, redeemCoupon, cancel },
  billingApi: { invoices },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ bootstrapMe }) }));

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

beforeEach(() => {
  vi.clearAllMocks();
  invoices.mockResolvedValue({ invoices: [], next_cursor: null });
});

describe("Subscription — renewal price", () => {
  it("shows the renewal price in the subscription's own currency", async () => {
    mine.mockResolvedValue(sub("active", { interval: "year", plan_currency: "USD", renewal_amount_cents: 7188 }));
    renderPage();
    expect(await screen.findByText("US$71.88/년")).toBeInTheDocument();
    expect(screen.getByText("갱신 금액")).toBeInTheDocument();
  });

  it("has no billing country to show or change (the phone number decides the currency)", async () => {
    mine.mockResolvedValue(sub("active", { interval: "year", plan_currency: "USD", renewal_amount_cents: 7188 }));
    renderPage();
    await screen.findByText("US$71.88/년");
    expect(screen.queryByTestId("billing-country-row")).not.toBeInTheDocument();
    expect(screen.queryByText(/결제 국가/)).not.toBeInTheDocument();
  });
});

describe("Subscription — my plan", () => {
  it.each(["trial", "trial_ending", "active", "payment_pending", "payment_failed", "grace_period"])(
    "offers 해지하기 for a %s subscription",
    async (status) => {
    // Regression: `trial_ending` (a trial in its last 72h) hid the button, so a
    // member could not cancel right before the first charge — and so did the
    // renewal-retry states, which the server cancels from just as well.
    mine.mockResolvedValue(sub(status));
    renderPage();
    expect(await screen.findByRole("button", { name: "해지하기" })).toBeInTheDocument();
    },
  );

  it.each(["suspended", "expired"])("has no 해지하기 for a %s subscription (the server refuses it)", async (status) => {
    mine.mockResolvedValue(sub(status));
    renderPage();
    await screen.findByText("내 구독정보");
    expect(screen.queryByRole("button", { name: "해지하기" })).not.toBeInTheDocument();
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

  it("offers nothing to cancel on a coupon pass (status active, nothing renews)", async () => {
    // Subscription.start_coupon_period makes the row `active` without a provider.
    mine.mockResolvedValue(sub("active", { coupon_backed: true, plan_id: null, plan_name: null, provider: null }));
    renderPage();
    expect(await screen.findByText("프리미엄")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해지하기" })).not.toBeInTheDocument();
  });

  it("hides 해지하기 once a cancellation is already scheduled", async () => {
    mine.mockResolvedValue(sub("active", { cancel_at_period_end: true }));
    renderPage();
    expect(await screen.findByText("Annual")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "해지하기" })).not.toBeInTheDocument();
  });
});

describe("Subscription — cancellation reason", () => {
  async function openReasonStep() {
    mine.mockResolvedValue(sub("active"));
    cancel.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "해지하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "해지" }));
    await screen.findByText("해지 사유를 선택해주세요");
  }

  it("sends the survey choice as the server's reason value", async () => {
    // Regression: the modal sent its own ids ("price", …), which the server
    // refuses with 422 — every cancel with a reason failed.
    await openReasonStep();
    await userEvent.click(screen.getByRole("radio", { name: "가격이 부담됩니다" }));
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("too_expensive", undefined));
  });

  it("sends 기타 as reason 'other' with the typed text in reason_text", async () => {
    await openReasonStep();
    await userEvent.click(screen.getByRole("radio", { name: "기타 (직접입력)" }));
    expect(screen.getByRole("button", { name: "제출" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  너무 바빠요  " } });
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith("other", "너무 바빠요"));
  });

  it("cancels with no reason on 건너뛰기", async () => {
    await openReasonStep();
    await userEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    await waitFor(() => expect(cancel).toHaveBeenCalledWith(undefined, undefined));
  });
});

describe("Subscription — billing history", () => {
  const invoice = (over: Record<string, unknown>) => ({
    invoice_id: "inv_1",
    plan_id: "p_year",
    plan_name: "Annual",
    total: { amount_cents: 7188, currency: "USD" },
    status: "paid",
    period_start: "2026-09-01T00:00:00Z",
    period_end: "2026-10-01T00:00:00Z",
    paid_at: "2026-09-01T00:00:00Z",
    receipt_url: null,
    ...over,
  });

  it("says when an invoice is not a completed payment", async () => {
    // GET /billing/invoices lists every invoice — an open renewal (still
    // being retried) and a void one must not read as money taken.
    mine.mockResolvedValue(sub("payment_failed"));
    invoices.mockResolvedValue({
      invoices: [
        invoice({ invoice_id: "inv_open", status: "open", paid_at: null }),
        invoice({ invoice_id: "inv_void", status: "void", paid_at: null }),
        invoice({ invoice_id: "inv_paid" }),
      ],
      next_cursor: null,
    });
    renderPage();
    expect(await screen.findByText("미결제")).toBeInTheDocument();
    expect(screen.getByText("결제 실패")).toBeInTheDocument();
    expect(screen.getAllByText("US$71.88")).toHaveLength(3);
    expect(screen.getByRole("listitem", { name: /US\$71\.88, 미결제/ })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /US\$71\.88$/ })).toBeInTheDocument();
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
    // The grant changes membership, which the premium gates read from the profile.
    expect(bootstrapMe).toHaveBeenCalled();
  });

  it("sends the code exactly as typed: codes are case-sensitive", async () => {
    // Regression: the field upper-cased what was typed, so a code with a
    // lowercase letter (the server's alphabet has 62 symbols) was never found.
    mine.mockResolvedValue(NO_SUB);
    redeemCoupon.mockResolvedValue({
      coupon_id: "c2",
      code: "A1bC-2dEf-3GhI",
      plan_name: "Partner pass",
      subscription_type: "course_pass_coupon",
      duration_days: 30,
      activated: true,
      queue_position: 1,
      effective_start_at: "2026-09-01T00:00:00Z",
      effective_end_at: "2026-10-01T00:00:00Z",
    });
    renderPage();
    await submitCode(" A1bC-2dEf-3GhI ");
    await waitFor(() => expect(redeemCoupon).toHaveBeenCalledWith("A1bC-2dEf-3GhI"));
  });

  it("keeps the code entry open (not 'invalid code') when the attempt cap is hit", async () => {
    mine.mockResolvedValue(NO_SUB);
    redeemCoupon.mockRejectedValue(
      new ApiError(429, "rate_limited", "You've reached the daily coupon redemption limit.", {
        reason: "coupon_daily_limit",
        limit: 10,
      }),
    );
    renderPage();
    await submitCode("ABCD-1234-EFGH");
    await waitFor(() => expect(redeemCoupon).toHaveBeenCalled());
    expect(
      await screen.findByText("쿠폰 등록은 24시간에 10번까지 시도할 수 있어요. 나중에 다시 시도해 주세요."),
    ).toBeInTheDocument();
  });
});
