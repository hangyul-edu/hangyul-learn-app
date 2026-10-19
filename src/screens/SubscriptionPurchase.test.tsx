import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { plans, mine, billing, paymentMethods, startTrial, subscribe, toastShow, toastError, bootstrapMe } = vi.hoisted(() => ({
  bootstrapMe: vi.fn(async () => ({})),
  plans: vi.fn(),
  mine: vi.fn(),
  billing: vi.fn(),
  paymentMethods: vi.fn(),
  startTrial: vi.fn(),
  subscribe: vi.fn(),
  toastShow: vi.fn(),
  toastError: vi.fn(),
}));
// The screen reads one call, GET /subscriptions/offers. The tests set its
// parts separately: the plans offered (`plans`), the member's trial
// eligibility (`mine`, as /subscriptions/me reports it) and their billing
// currency (`billing`: the server's, from their phone number).
vi.mock("../api/endpoints", () => ({
  subApi: {
    offers: async () => {
      const [p, m, b] = await Promise.all([plans(), mine(), billing()]);
      return { plans: p.plans, new_member: false, trial: { available: !!m.trial_available, days: 7 }, ...b };
    },
    startTrial,
    subscribe,
  },
  payApi: { methods: paymentMethods },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: toastError, success: vi.fn(), show: toastShow }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ bootstrapMe }) }));

import { SubscriptionPurchase } from "./SubscriptionPurchase";
import { I18nProvider } from "../i18n";

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
    badge: { ko: "런칭 기념 특별 할인", en: "Launch special" },
  },
  {
    plan_id: "p_month", name: "Monthly", interval: "month", currency: "USD",
    price_cents: 1299, promo_price_cents: 999,
    original_total_cents: 1299, current_total_cents: 999,
    original_monthly_cents: 1299, current_monthly_cents: 999, discount_percent: 23,
  },
];
/** What the screen shows for the annual plan, sent so a stale price is refused. */
const YEAR_QUOTE = { currency: "USD", quoted_amount_cents: 7188 };
const METHOD = { method_id: "pm1", kind: "card", provider: "toss_card", status: "active", is_default: true, display_name: "카드" };

/** The payment screen's back arrow (DetailHeader: one history step back). */
function Back() {
  const nav = useNavigate();
  return <button onClick={() => nav(-1)}>BACK</button>;
}

function renderPage(entry: string | { pathname: string; state?: unknown } = "/subscription/start") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/subscription/start" element={<><SubscriptionPurchase /><Loc /></>} />
            <Route path="/subscription" element={<><div>MANAGE</div><Loc /></>} />
            <Route path="/account/payment" element={<><div>PAYMENT REG</div><Back /><Loc /></>} />
            <Route path="/policy/refund" element={<div>REFUND POLICY</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  plans.mockResolvedValue({ plans: PLANS });
  mine.mockResolvedValue({ status: "expired", trial_started: false, trial_available: true });
  billing.mockResolvedValue({ currency: "USD" });
  paymentMethods.mockResolvedValue({ methods: [METHOD] });
  startTrial.mockResolvedValue({});
  subscribe.mockResolvedValue({});
});

describe("SubscriptionPurchase", () => {
  it("eligible account shows the trial variant with the trial CTA + eyebrow", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" })).toBeInTheDocument();
    expect(screen.getByText("일주일 무료로 먼저 체험해보세요.")).toBeInTheDocument();
  });

  it("ineligible account shows the paid variant, no trial messaging", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    renderPage();
    expect(await screen.findByRole("button", { name: "지금 바로 시작하기" })).toBeInTheDocument();
    expect(screen.queryByText("일주일 무료로 먼저 체험해보세요.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7일 무료 체험 시작하기" })).not.toBeInTheDocument();
  });

  it("a person who trialled on a withdrawn account gets the paid variant on the new one", async () => {
    // This account never started a trial, but its person did before
    // withdrawing and signing up again: one trial per person.
    mine.mockResolvedValue({ status: "expired", trial_started: false, trial_available: false });
    renderPage();
    expect(await screen.findByRole("button", { name: "지금 바로 시작하기" })).toBeInTheDocument();
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

  it("shows a new member's price from the same plan, against its list price", async () => {
    // The server prices the plan for the caller: the yearly plan's new-member
    // price ($47.88 = $3.99/mo, 69% off the $155.88 list price).
    plans.mockResolvedValue({
      plans: [
        {
          ...PLANS[0],
          new_member_price_cents: 4788, new_member_price: true,
          current_total_cents: 4788, current_monthly_cents: 399, discount_percent: 69,
        },
        PLANS[1],
      ],
    });
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    const year = screen.getByRole("radio", { name: /12개월/ });
    expect(within(year).getByText("$3.99")).toBeInTheDocument();
    expect(within(year).getByText("($47.88)")).toBeInTheDocument();
    expect(within(year).getByText("최대 69%할인")).toBeInTheDocument();
    expect(within(year).getByText("$12.99/월 ($155.88)")).toBeInTheDocument();
  });

  it("makes room above a card whose ribbon would overlap the card before it", async () => {
    plans.mockResolvedValue({ plans: [PLANS[0], { ...PLANS[1], badge: { ko: "가장 인기 있는 플랜", en: "Most popular" } }] });
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    expect(screen.getByRole("radio", { name: /1개월/ })).toHaveClass("plan--ribboned");
    expect(screen.getByRole("radio", { name: /12개월/ })).toHaveClass("plan--ribboned");
    plans.mockResolvedValue({ plans: PLANS });
  });

  it("prints KRW plans in whole won, not won ÷ 100", async () => {
    // Regression: every currency was divided by 100, so ₩9,900 showed as ₩99.
    plans.mockResolvedValue({
      plans: [
        {
          plan_id: "p_month_krw", name: "월간", interval: "month", currency: "KRW",
          price_cents: 12900, promo_price_cents: 9900,
          original_total_cents: 12900, current_total_cents: 9900,
          original_monthly_cents: 12900, current_monthly_cents: 9900, discount_percent: 23,
        },
      ],
    });
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    // Korean copy writes won after the number, as SET-032 KO draws it.
    expect(screen.getAllByText("9,900원").length).toBeGreaterThan(0);
    expect(screen.queryByText("99원")).not.toBeInTheDocument();
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
    expect(await screen.findByText("결제 수단 등록이 필요해요")).toBeInTheDocument();
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
    await waitFor(() => expect(startTrial).toHaveBeenCalledWith("p_year", YEAR_QUOTE));
    expect(screen.queryByText("결제 수단 등록이 필요해요")).not.toBeInTheDocument();
  });

  it("cancel closes the popup without billing; register navigates to payment setup", async () => {
    paymentMethods.mockResolvedValue({ methods: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "취소" }));
    expect(screen.queryByText("결제 수단 등록이 필요해요")).not.toBeInTheDocument();
    expect(startTrial).not.toHaveBeenCalled();
    // Re-open + register → payment page, selected plan preserved in route state.
    await userEvent.click(screen.getByRole("button", { name: "7일 무료 체험 시작하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "결제 수단 등록" }));
    await waitFor(() => expect(screen.getByText("PAYMENT REG")).toBeInTheDocument());
    expect(screen.getByTestId("loc")).toHaveTextContent('"selectedPlanId":"p_year"');
  });

  it("waits for the payment methods before the CTA can be pressed", async () => {
    // A member with a card must never be asked to register one because the
    // methods had not arrived yet.
    let resolve: (v: unknown) => void = () => {};
    paymentMethods.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderPage();
    expect(await screen.findByText("불러오는 중…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "7일 무료 체험 시작하기" })).not.toBeInTheDocument();
    resolve({ methods: [METHOD] });
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(startTrial).toHaveBeenCalled());
    expect(screen.queryByText("결제 수단 등록이 필요해요")).not.toBeInTheDocument();
  });

  it("offers a retry instead of the register prompt when the methods failed to load", async () => {
    paymentMethods.mockRejectedValueOnce(new Error("down"));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(startTrial).toHaveBeenCalled());
    expect(screen.queryByText("결제 수단 등록이 필요해요")).not.toBeInTheDocument();
  });

  it("keeps the picked plan when the member comes Back without registering", async () => {
    paymentMethods.mockResolvedValue({ methods: [] });
    renderPage();
    await userEvent.click(await screen.findByRole("radio", { name: /월간|매월|1개월/ }));
    await userEvent.click(screen.getByRole("button", { name: "7일 무료 체험 시작하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "결제 수단 등록" }));
    await userEvent.click(await screen.findByRole("button", { name: "BACK" }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent('/subscription/start{"selectedPlanId":"p_month"}'));
    await waitFor(() => expect(screen.getAllByRole("radio").find((r) => r.getAttribute("aria-checked") === "true")?.className).toContain("plan--monthly"));
  });

  it("shows the plan the payment screen came back with", async () => {
    renderPage({ pathname: "/subscription/start", state: { selectedPlanId: "p_month" } });
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    const checked = screen.getAllByRole("radio").find((r) => r.getAttribute("aria-checked") === "true");
    expect(checked?.className).toContain("plan--monthly");
  });

  it("trial CTA (with a valid method) calls the trial endpoint, then routes to management", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(startTrial).toHaveBeenCalledWith("p_year", YEAR_QUOTE));
    expect(subscribe).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText("MANAGE")).toBeInTheDocument());
    // The profile's membership drives the premium gates: it is re-read.
    expect(bootstrapMe).toHaveBeenCalled();
  });

  it("paid CTA (ineligible) calls the paid endpoint, never the trial one", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith("p_year", undefined, YEAR_QUOTE));
    expect(startTrial).not.toHaveBeenCalled();
    expect(toastShow).not.toHaveBeenCalled();
  });

  it("a first charge still being confirmed says so instead of claiming access", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    subscribe.mockResolvedValue({ subscription: { status: "payment_pending" } });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    await waitFor(() =>
      expect(toastShow).toHaveBeenCalledWith("결제를 확인하고 있어요. 완료되면 바로 이용할 수 있어요."),
    );
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
    await userEvent.click(await screen.findByRole("button", { name: "[환불 정책 보기]" }));
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
    // The ribbon is the exported Figma artwork with the label riding on top,
    // so the text node is the label inside `.plan__ribbon`.
    const ribbon = within(annual).getByText("런칭 기념 특별 할인");
    expect(ribbon).toHaveClass("plan__ribbon-text");
    expect(ribbon.closest(".plan__ribbon")).not.toBeNull();
    expect(within(monthly).queryByText("런칭 기념 특별 할인")).not.toBeInTheDocument();
  });

  it("draws the ribbon the admin published, on whichever card, in the app language", async () => {
    plans.mockResolvedValue({
      plans: [
        { ...PLANS[0], badge: null },
        { ...PLANS[1], badge: { ko: "첫 달 특가", en: "First month deal" } },
      ],
    });
    const { annual, monthly } = await cards();
    expect(within(monthly).getByText("첫 달 특가")).toHaveClass("plan__ribbon-text");
    expect(annual.querySelector(".plan__ribbon")).toBeNull();
  });

  it("shows no discount pill or struck price for a plan without a promo", async () => {
    plans.mockResolvedValue({
      plans: PLANS.map((p) => ({
        ...p,
        promo_price_cents: null,
        current_total_cents: p.price_cents,
        current_monthly_cents: p.original_monthly_cents,
        discount_percent: 0,
      })),
    });
    const { annual, monthly } = await cards();
    expect(annual.querySelector("s")).toBeNull();
    expect(monthly.querySelector("s")).toBeNull();
    expect(screen.queryByText(/0% 할인/)).not.toBeInTheDocument();
    expect(within(monthly).getByText("$12.99")).toBeInTheDocument();
  });

  it("annual right column stacks purple badge, one struck original, then final price", async () => {
    const { annual } = await cards();
    expect(within(annual).getByText("12개월")).toBeInTheDocument();
    // Purple discount badge (upper-right).
    const hl = within(annual).getByText("최대 54%할인"); // yellow-highlighted part
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
    // The rule runs through the whole original price, /월 suffix included.
    expect(within(monthly).getByText("$12.99/월").closest("s")).toBeInTheDocument();
    // The badge sits on that same row, immediately before the struck price.
    expect(pill.closest(".plan__month-row")).not.toBeNull();
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
    expect(screen.getByText("최대 60%할인")).toBeInTheDocument(); // server, not 50%
    expect(screen.getByText("25% 할인")).toBeInTheDocument(); // server, not 20%
    expect(screen.getByText("$5.00")).toBeInTheDocument(); // server current_monthly_cents
    expect(screen.getByText("$9.99/월 ($120.00)").closest("s")).toBeInTheDocument(); // server monthly+total
  });
});

describe("SubscriptionPurchase currency pre-check", () => {
  const KRW_CARD = { ...METHOD, card_region: "domestic", billing_currency: "KRW" };
  const USD_CARD = { ...METHOD, method_id: "pm_usd", is_default: false, provider: "toss_intl_card", card_region: "international", billing_currency: "USD" };

  it("explains a KRW default method vs a USD plan and never calls subscribe", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    paymentMethods.mockResolvedValue({ methods: [KRW_CARD] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("이 결제수단으로는 결제할 수 없어요")).toBeInTheDocument();
    expect(within(dialog).getByText(/원화\(KRW\)로만 결제돼요. 미국 달러\(USD\) 요금제는 해외 카드로/)).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
    expect(startTrial).not.toHaveBeenCalled();
    // The path out: straight to the overseas-card form, keeping the plan.
    await userEvent.click(within(dialog).getByRole("button", { name: "해외 카드 등록" }));
    expect(await screen.findByText("PAYMENT REG")).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).toContain('"addCard":"international"');
    expect(screen.getByTestId("loc").textContent).toContain('"selectedPlanId":"p_year"');
  });

  it("also blocks the trial, and suggests switching when a matching method exists", async () => {
    paymentMethods.mockResolvedValue({ methods: [KRW_CARD, USD_CARD] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/미국 달러\(USD\) 결제수단을 기본 결제수단으로 선택하면/)).toBeInTheDocument();
    expect(startTrial).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "결제수단 관리" }));
    expect(await screen.findByText("PAYMENT REG")).toBeInTheDocument();
    expect(screen.getByTestId("loc").textContent).not.toContain("addCard");
  });

  it("proceeds when the default method's currency matches the plan", async () => {
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    paymentMethods.mockResolvedValue({ methods: [{ ...USD_CARD, is_default: true }] });
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith("p_year", undefined, YEAR_QUOTE));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("still maps a server subscription.currency_mismatch as a fallback", async () => {
    const { ApiError } = await import("../lib/http");
    mine.mockResolvedValue({ status: "expired", trial_started: true, trial_available: false });
    subscribe.mockRejectedValue(
      new ApiError(422, "subscription.currency_mismatch", "raw", { card_currency: "KRW", plan_currency: "USD" }),
    );
    renderPage(); // METHOD has no billing_currency: the pre-check cannot tell
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 시작하기" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/원화\(KRW\)로만 결제돼요/);
  });
});

describe("SubscriptionPurchase — currency and what is charged", () => {
  const KR_PLANS = [
    {
      ...PLANS[0], currency: "KRW", price_cents: 154800, promo_price_cents: 69000,
      original_total_cents: 154800, current_total_cents: 69000,
      original_monthly_cents: 12900, current_monthly_cents: 5750, discount_percent: 55,
    },
    {
      ...PLANS[1], currency: "KRW", price_cents: 12900, promo_price_cents: 9900,
      original_total_cents: 12900, current_total_cents: 9900,
      original_monthly_cents: 12900, current_monthly_cents: 9900, discount_percent: 23,
    },
  ];

  it("has no billing-country picker, charge summary or payment-method list", async () => {
    // The currency follows the phone number on the server; the screen is the
    // plans, the CTA and the notes — nothing for the member to choose.
    renderPage();
    await screen.findByRole("button", { name: "7일 무료 체험 시작하기" });
    expect(screen.queryByTestId("billing-country")).not.toBeInTheDocument();
    expect(screen.queryByTestId("charge-summary")).not.toBeInTheDocument();
    expect(screen.queryByText(/결제 국가/)).not.toBeInTheDocument();
    expect(screen.queryByText(/결제 수단:/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "변경" })).not.toBeInTheDocument();
  });

  it("prices a +82 member in won and sends the price shown", async () => {
    billing.mockResolvedValue({ currency: "KRW" });
    plans.mockResolvedValue({ plans: KR_PLANS });
    paymentMethods.mockResolvedValue({ methods: [{ ...METHOD, billing_currency: "KRW" }] });
    renderPage();
    expect(await screen.findByText("5,750원")).toBeInTheDocument();
    expect(screen.getByText("(69,000원)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() =>
      expect(startTrial).toHaveBeenCalledWith("p_year", { currency: "KRW", quoted_amount_cents: 69000 }),
    );
  });

  it("re-reads the offers instead of charging a price that changed", async () => {
    const { ApiError } = await import("../lib/http");
    startTrial.mockRejectedValue(
      new ApiError(409, "subscription.price_changed", "x", { currency: "USD", amount_cents: 7999, quoted_amount_cents: 7188 }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "7일 무료 체험 시작하기" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("가격이 변경됐어요. 새 가격을 확인한 뒤 다시 시도해 주세요."));
    await waitFor(() => expect(plans.mock.calls.length).toBeGreaterThan(1));
    expect(screen.queryByText("MANAGE")).not.toBeInTheDocument();
  });
});
