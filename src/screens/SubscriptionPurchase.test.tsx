import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { plans, mine, paymentMethods, startTrial, subscribe } = vi.hoisted(() => ({
  plans: vi.fn(),
  mine: vi.fn(),
  paymentMethods: vi.fn(),
  startTrial: vi.fn(),
  subscribe: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { plans, mine, paymentMethods, startTrial, subscribe },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

import { SubscriptionPurchase } from "./SubscriptionPurchase";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{JSON.stringify((l.state as unknown) ?? null)}</div>;
}

// Plans as the server sends them: two price tiers plus the server-computed
// presentation values. Annual: $155.88 → $71.88 ($12.99/mo → $5.99/mo, 54% off).
// Monthly: $12.99 → $9.99 (23% off).
const PLANS = [
  {
    plan_id: "p_year", name: "Annual", interval: "year", currency: "USD",
    price_cents: 15588, promo_price_cents: 7188,
    original_total_cents: 15588, current_total_cents: 7188,
    original_monthly_cents: 1299, current_monthly_cents: 599, discount_percent: 54,
  },
  {
    plan_id: "p_month", name: "Monthly", interval: "month", currency: "USD",
    price_cents: 1299, promo_price_cents: 999,
    original_total_cents: 1299, current_total_cents: 999,
    original_monthly_cents: 1299, current_monthly_cents: 999, discount_percent: 23,
  },
];
const METHOD = { method_id: "pm1", kind: "card", provider: "toss_card", status: "active", is_default: true, display_name: "카드" };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/subscription/start"]}>
        <Routes>
          <Route path="/subscription/start" element={<><SubscriptionPurchase /><Loc /></>} />
          <Route path="/subscription" element={<><div>MANAGE</div><Loc /></>} />
          <Route path="/account/payment" element={<><div>PAYMENT REG</div><Loc /></>} />
          <Route path="/policy/refund" element={<div>REFUND POLICY</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  plans.mockResolvedValue({ plans: PLANS });
  mine.mockResolvedValue({ status: "expired", trial_started: false });
  paymentMethods.mockResolvedValue({ methods: [METHOD] });
  startTrial.mockResolvedValue({});
  subscribe.mockResolvedValue({});
});

describe("SubscriptionPurchase", () => {
  it("eligible account shows the trial variant with the trial CTA + eyebrow", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" })).toBeInTheDocument();
    expect(screen.getByText("일주일 무료로 먼저 체험해보세요")).toBeInTheDocument();
  });

  it("ineligible account shows the paid variant, no trial messaging", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true });
    renderPage();
    expect(await screen.findByRole("button", { name: "지금 바로 시작하기" })).toBeInTheDocument();
    expect(screen.queryByText("일주일 무료로 먼저 체험해보세요")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7일 무료 체험 시작하기" })).not.toBeInTheDocument();
  });

  it("renders plans + prices from the API and selects the annual plan by default", async () => {
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    // Monthly-equivalent + annual total from the server price.
    expect(screen.getByText("$5.99")).toBeInTheDocument();
    expect(screen.getByText("($71.88)")).toBeInTheDocument();
    const year = screen.getByRole("radio", { name: /12개월/ });
    expect(year).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /1개월/ })).toHaveAttribute("aria-checked", "false");
  });

  it("shows the empty state with a disabled CTA and no fake prices when no plans", async () => {
    plans.mockResolvedValue({ plans: [] });
    renderPage();
    expect(await screen.findByText(/이용 가능한 구독 상품이 없어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "7일 무료 체험 시작하기" })).toBeDisabled();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("selects only one plan at a time", async () => {
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    await userEvent.click(screen.getByRole("radio", { name: /1개월/ }));
    expect(screen.getByRole("radio", { name: /1개월/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /12개월/ })).toHaveAttribute("aria-checked", "false");
  });

  it("opens the payment-method popup (no billing call) only when NO method is registered", async () => {
    paymentMethods.mockResolvedValue({ methods: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    expect(await screen.findByText("결제수단 등록이 필요해요")).toBeInTheDocument();
    expect(startTrial).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("proceeds immediately with a registered non-default quick-pay method (no popup)", async () => {
    // A registered quick-pay wallet that is NOT the default. Payment must still
    // proceed — the popup is only for users with no payment method at all.
    paymentMethods.mockResolvedValue({
      methods: [
        { method_id: "pm2", kind: "naver_pay", provider: "naver_pay", status: "active", is_default: false, display_name: "네이버페이" },
      ],
    });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(startTrial).toHaveBeenCalledWith("p_year"));
    expect(screen.queryByText("결제수단 등록이 필요해요")).not.toBeInTheDocument();
  });

  it("cancel closes the popup without billing; register navigates to payment setup", async () => {
    paymentMethods.mockResolvedValue({ methods: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(screen.queryByText("결제수단 등록이 필요해요")).not.toBeInTheDocument();
    expect(startTrial).not.toHaveBeenCalled();
    // Re-open + register → payment page, selected plan preserved in route state.
    await userEvent.click(screen.getByRole("button", { name: "7일 무료 체험 시작하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "결제수단 등록하기" }));
    await waitFor(() => expect(screen.getByText("PAYMENT REG")).toBeInTheDocument());
    expect(screen.getByTestId("loc")).toHaveTextContent('"selectedPlanId":"p_year"');
  });

  it("trial CTA (with a valid method) calls the trial endpoint, then routes to management", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(startTrial).toHaveBeenCalledWith("p_year"));
    expect(subscribe).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("MANAGE")).toBeInTheDocument());
  });

  it("paid CTA (ineligible) calls the paid endpoint, never the trial one", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith("p_year"));
    expect(startTrial).not.toHaveBeenCalled();
  });

  it("duplicate CTA taps send only one request", async () => {
    startTrial.mockReturnValue(new Promise(() => {})); // stays pending
    renderPage();
    const cta = await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    await userEvent.click(cta);
    await userEvent.click(cta);
    expect(startTrial).toHaveBeenCalledTimes(1);
  });

  it("opens the refund policy page from the link", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "환불 정책 보기" }));
    await waitFor(() => expect(screen.getByText("REFUND POLICY")).toBeInTheDocument());
  });

  it("does not flash the wrong variant while eligibility is loading", () => {
    mine.mockReturnValue(new Promise(() => {})); // pending
    renderPage();
    expect(screen.queryByRole("button", { name: "7일 무료 체험 시작하기" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "지금 바로 시작하기" })).not.toBeInTheDocument();
  });
});

describe("SubscriptionPurchase — plan cards", () => {
  async function cards() {
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    return {
      annual: screen.getByRole("radio", { name: /12개월/ }),
      monthly: screen.getByRole("radio", { name: /1개월/ }),
    };
  }

  it("annual card is the larger annual variant; monthly is the compact variant", async () => {
    const { annual, monthly } = await cards();
    expect(annual).toHaveClass("plan--annual");
    expect(monthly).toHaveClass("plan--monthly");
  });

  it("only the annual card carries the launch ribbon overlapping the card", async () => {
    const { annual, monthly } = await cards();
    const ribbon = within(annual).getByText("런칭 기념 특별 할인");
    expect(ribbon).toHaveClass("plan__ribbon");
    expect(within(monthly).queryByText("런칭 기념 특별 할인")).not.toBeInTheDocument();
  });

  it("annual right column stacks purple badge, one struck original, then final price", async () => {
    const { annual } = await cards();
    expect(within(annual).getByText("12개월")).toBeInTheDocument();
    // Purple discount badge (upper-right).
    const hl = within(annual).getByText("최대 54% 할인"); // yellow-highlighted part
    expect(hl).toHaveClass("plan__badge-hl");
    expect(hl.closest(".plan__badge")).toHaveClass("plan__badge--purple");
    // A single struck original line covering monthly + annual total.
    expect(within(annual).getByText("$12.99/월 ($155.88)").closest("s")).toBeInTheDocument();
    // Final current price below.
    expect(within(annual).getByText("$5.99")).toHaveClass("plan__final-main");
  });

  it("annual selected radio is orange (selected state via class), swaps on monthly select", async () => {
    const { annual, monthly } = await cards();
    expect(annual).toHaveClass("plan--on");
    expect(monthly).not.toHaveClass("plan--on");
    await userEvent.click(within(monthly).getByText("1개월")); // tap the label, not just a radio
    expect(monthly).toHaveClass("plan--on");
    expect(annual).not.toHaveClass("plan--on");
  });

  it("annual final price uses three distinctly-styled parts", async () => {
    const { annual } = await cards();
    expect(within(annual).getByText("$5.99")).toHaveClass("plan__final-main");
    expect(within(annual).getByText("/월")).toHaveClass("plan__final-per");
    expect(within(annual).getByText("($71.88)")).toHaveClass("plan__final-total");
  });

  it("renders no orange arrow/zigzag graphic and no intermediate $7.99/$95.88 tier", async () => {
    await cards();
    expect(document.querySelector("svg.plan__strike")).toBeNull();
    expect(screen.queryByText(/\$7\.99/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$95\.88/)).not.toBeInTheDocument();
  });

  it("monthly card: gray unselected radio, black discount pill, struck original, current price below", async () => {
    const { monthly } = await cards();
    expect(monthly).not.toHaveClass("plan--on"); // gray/unselected by default
    const pill = within(monthly).getByText("23% 할인");
    expect(pill).toHaveClass("plan__badge--black");
    expect(within(monthly).getByText(/\$12\.99\/월/).closest("s")).toBeInTheDocument();
    const cur = within(monthly).getByText("$9.99");
    expect(cur).toHaveClass("plan__final-main");
    expect(cur.closest(".plan__month-cur")).not.toBeNull();
  });

  it("renders the server's computed values verbatim (not client-derived)", async () => {
    // Server-provided presentation values that do NOT match a naive derivation
    // from the price tiers — the UI must show the server numbers.
    plans.mockResolvedValue({
      plans: [
        {
          plan_id: "p_year", name: "Annual", interval: "year", currency: "USD",
          price_cents: 12000, promo_price_cents: 6000,
          original_total_cents: 12000, current_total_cents: 6000,
          original_monthly_cents: 999, current_monthly_cents: 500, discount_percent: 60,
        },
        {
          plan_id: "p_month", name: "Monthly", interval: "month", currency: "USD",
          price_cents: 1000, promo_price_cents: 800,
          original_total_cents: 1000, current_total_cents: 800,
          original_monthly_cents: 1000, current_monthly_cents: 800, discount_percent: 25,
        },
      ],
    });
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    expect(screen.getByText("최대 60% 할인")).toBeInTheDocument(); // server, not 50%
    expect(screen.getByText("25% 할인")).toBeInTheDocument(); // server, not 20%
    expect(screen.getByText("$5.00")).toBeInTheDocument(); // server current_monthly_cents
    expect(screen.getByText("$9.99/월 ($120.00)").closest("s")).toBeInTheDocument(); // server monthly+total
  });
});
