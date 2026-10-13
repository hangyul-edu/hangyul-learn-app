import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";
import { ApiError, NetworkError } from "../lib/http";
import type { PaymentMethod } from "../lib/types";

// Mock only the network boundary — the tests never hit a real backend.
vi.mock("../api/endpoints", () => ({
  payApi: {
    methods: vi.fn(),
    cardIntent: vi.fn(),
    cardConfirm: vi.fn(),
    internationalCardOptions: vi.fn(),
    registerInternationalCard: vi.fn(),
    tosspayIntent: vi.fn(),
    tosspayConfirm: vi.fn(),
    naverpayIntent: vi.fn(),
    naverpayConfirm: vi.fn(),
    setDefault: vi.fn(),
    replace: vi.fn(),
    remove: vi.fn(),
  },
  billingApi: { recovery: vi.fn(), invoice: vi.fn(), retryInvoice: vi.fn() },
  subApi: { mine: vi.fn(), offers: vi.fn() },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ bootstrapMe: vi.fn() }) }));
const requestTossBillingAuth = vi.fn();
vi.mock("../lib/tossPayments", () => ({
  requestTossBillingAuth: (opts: unknown) => requestTossBillingAuth(opts),
  requestBrandpayRegistration: vi.fn(),
  isUserCancel: () => false,
}));

import { billingApi, payApi, subApi } from "../api/endpoints";
import { PaymentMethods } from "./PaymentMethods";

const api = payApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const billing = billingApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const subs = subApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const PAN = "4242424242424242";
const OPTIONS = {
  available: true,
  currencies: [
    { currency: "KRW", requires_holder_birth_date: false, accepted_brands: ["visa", "mastercard", "jcb", "amex"] },
    { currency: "USD", requires_holder_birth_date: false, accepted_brands: ["visa", "mastercard", "jcb"] },
  ],
};
const INTL_CARD: PaymentMethod = {
  method_id: "pm_intl",
  kind: "card",
  provider: "toss_intl_card",
  status: "active",
  is_default: true,
  display_name: "Visa (42424242****424*)",
  brand: "visa",
  issuer: "Visa",
  last_four: "4242",
  masked_card_number: "42424242****424*",
  card_region: "international",
  billing_currency: "USD",
};

/** A member whose phone number is outside +82: billed in USD, registers overseas cards. */
const OVERSEAS = { currency: "USD", card_region: "international" } as const;
/** A +82 member: billed in KRW, registers domestic cards. */
const DOMESTIC = { currency: "KRW", card_region: "domestic" } as const;

function renderScreen(state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const utils = render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[{ pathname: "/account/payment", state }]}>
          <ToastProvider>
            <PaymentMethods />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { ...utils, qc };
}

async function openForm() {
  await userEvent.click(await screen.findByLabelText("해외 카드 추가"));
  return screen.findByRole("dialog");
}

const CONSENT = /매 결제 주기마다 이 카드로 구독 요금이 자동 결제되는 데 동의해요/;

async function fillCard(number = PAN, expiry = "0731", { consent = true } = {}) {
  await userEvent.type(screen.getByLabelText("카드 번호"), number);
  await userEvent.type(screen.getByLabelText("유효기간 (MM/YY)"), expiry);
  const agree = screen.getByRole("checkbox", { name: CONSENT });
  if (consent && !(agree as HTMLInputElement).checked) await userEvent.click(agree);
}

const consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  api.methods.mockResolvedValue({ methods: [], registration: OVERSEAS });
  api.internationalCardOptions.mockResolvedValue(OPTIONS);
  billing.recovery.mockResolvedValue({ recovery_required: false, can_retry_immediately: false });
  subs.mine.mockResolvedValue({ status: "none" });
  subs.offers.mockResolvedValue({ plans: [], new_member: false, trial: { available: false, days: 7 } });
  for (const m of ["log", "info", "warn", "error", "debug"] as const) {
    consoleSpies.push(vi.spyOn(console, m).mockImplementation(() => {}));
  }
});
afterEach(() => {
  // PCI: no console call anywhere in a test may carry the card number.
  for (const spy of consoleSpies) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(PAN);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("4242 4242");
    spy.mockRestore();
  }
  consoleSpies.length = 0;
});

describe("one card button, decided by the phone number", () => {
  it("a +82 member sees only the domestic card button, charged in KRW, and the Korean wallets", async () => {
    api.methods.mockResolvedValue({ methods: [], registration: DOMESTIC });
    renderScreen();
    expect(await screen.findByLabelText("국내 카드 추가")).toBeInTheDocument();
    expect(screen.getByText("한국에서 발급한 카드 · 원화(KRW)로 결제")).toBeInTheDocument();
    expect(screen.queryByLabelText("해외 카드 추가")).not.toBeInTheDocument();
    expect(screen.getByLabelText("네이버페이 연결하기")).toBeInTheDocument();
    expect(screen.queryByText(/카드를 발급한 곳을 기준으로 골라 주세요/)).not.toBeInTheDocument();
  });

  it("anyone else sees only the overseas card button, charged in USD, and no wallets", async () => {
    renderScreen();
    expect(await screen.findByLabelText("해외 카드 추가")).toBeInTheDocument();
    expect(screen.getByText("해외에서 발급한 Visa·Mastercard·JCB 등 · 미국 달러(USD)로 결제")).toBeInTheDocument();
    expect(screen.queryByLabelText("국내 카드 추가")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "간편 결제" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("네이버페이 연결하기")).not.toBeInTheDocument();
  });

  it("an overseas member still sees a wallet already on file, so it can be removed", async () => {
    api.methods.mockResolvedValue({
      methods: [{ method_id: "pm_np", kind: "naver_pay", provider: "naver_pay", status: "active", is_default: true, display_name: "네이버페이" }],
      registration: OVERSEAS,
    });
    renderScreen();
    expect(await screen.findByLabelText("네이버페이 연결 해제")).toBeInTheDocument();
    expect(screen.queryByLabelText("국내 카드 추가")).not.toBeInTheDocument();
  });

  it("explains a refused registration with the phone-number rule", async () => {
    api.methods.mockResolvedValue({ methods: [], registration: DOMESTIC });
    api.cardIntent.mockRejectedValue(
      new ApiError(422, "payment_method.registration_not_offered", "raw", {
        billing_currency: "USD",
        card_region: "international",
        method_currency: "KRW",
      }),
    );
    renderScreen();
    await userEvent.click(await screen.findByLabelText("국내 카드 추가"));
    expect(
      await screen.findByText("+82가 아닌 휴대폰 번호로 가입한 회원은 미국 달러(USD)로 결제되며, 해외 카드만 등록할 수 있어요."),
    ).toBeInTheDocument();
    expect(requestTossBillingAuth).not.toHaveBeenCalled();
  });

  it("the domestic button still opens Toss's window through the SDK", async () => {
    const widget = { client_key: "test_ck", success_url: "https://s", fail_url: "https://f", card_region: "domestic" };
    api.cardIntent.mockResolvedValue({ intent_id: "pmi", customer_key: "cus", widget });
    requestTossBillingAuth.mockResolvedValue(undefined);
    api.methods.mockResolvedValue({ methods: [], registration: DOMESTIC });
    renderScreen();
    await userEvent.click(await screen.findByLabelText("국내 카드 추가"));
    await waitFor(() => expect(requestTossBillingAuth).toHaveBeenCalled());
    expect(api.cardIntent).toHaveBeenCalledWith(expect.any(String));
    expect(api.internationalCardOptions).not.toHaveBeenCalled();
  });

  it("the international button opens our own form, never the Toss window", async () => {
    renderScreen();
    await openForm();
    expect(await screen.findByLabelText("카드 번호")).toBeInTheDocument();
    expect(api.cardIntent).not.toHaveBeenCalled();
    expect(requestTossBillingAuth).not.toHaveBeenCalled();
  });
});

describe("international card form", () => {
  it("offers only the currencies the options endpoint lists and explains the binding", async () => {
    api.internationalCardOptions.mockResolvedValue({ available: true, currencies: [OPTIONS.currencies[1]] });
    renderScreen();
    await openForm();
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["미국 달러(USD)"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/선택한 통화로 결제돼요. 이 카드는 미국 달러\(USD\) 요금제 결제에만/)).toBeInTheDocument();
    // No CVC / PIN, and no birth date unless the currency requires it.
    expect(screen.queryByLabelText(/CVC|보안코드|비밀번호/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/생년월일/)).not.toBeInTheDocument();
  });

  it("uses card autocomplete attributes and numeric keyboards", async () => {
    renderScreen();
    await openForm();
    const number = await screen.findByLabelText("카드 번호");
    expect(number).toHaveAttribute("autocomplete", "cc-number");
    expect(number).toHaveAttribute("inputmode", "numeric");
    const expiry = screen.getByLabelText("유효기간 (MM/YY)");
    expect(expiry).toHaveAttribute("autocomplete", "cc-exp");
    expect(expiry).toHaveAttribute("inputmode", "numeric");
  });

  it("preselects the live subscription's plan_currency without joining plans", async () => {
    subs.mine.mockResolvedValue({ status: "active", plan_id: "plan_usd", plan_currency: "USD" });
    renderScreen();
    await openForm();
    await waitFor(() => expect(screen.getByRole("radio", { name: "미국 달러(USD)" })).toHaveAttribute("aria-checked", "true"));
    expect(screen.getByText(/이용 중인 요금제가 미국 달러\(USD\)로 결제돼서/)).toBeInTheDocument();
    expect(subs.offers).not.toHaveBeenCalled();
  });

  it("preselects the plan being bought when arriving from the purchase screen", async () => {
    subs.offers.mockResolvedValue({
      plans: [{ plan_id: "plan_usd", name: "P", price_cents: 1, currency: "USD", interval: "month" }],
      new_member: true,
      trial: { available: true, days: 7 },
    });
    renderScreen({ selectedPlanId: "plan_usd" });
    await openForm();
    await waitFor(() => expect(screen.getByRole("radio", { name: "미국 달러(USD)" })).toHaveAttribute("aria-checked", "true"));
  });

  it("locks the currency to required_currency and explains why", async () => {
    api.internationalCardOptions.mockResolvedValue({ ...OPTIONS, required_currency: "USD" });
    renderScreen();
    await openForm();
    const radios = await screen.findAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["미국 달러(USD)"]);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toBeDisabled();
    // required_currency is the member's billing currency, subscription or not.
    expect(screen.getByText(/회원님은 미국 달러\(USD\)로 결제되어 미국 달러\(USD\)로만 등록할 수 있어요/)).toBeInTheDocument();
  });

  it("shows 'not available' when the required currency isn't offered", async () => {
    api.internationalCardOptions.mockResolvedValue({ available: true, currencies: [OPTIONS.currencies[0]], required_currency: "USD" });
    renderScreen();
    await openForm();
    expect(await screen.findByText(/지금은 미국 달러\(USD\) 해외 카드를 등록할 수 없어요/)).toBeInTheDocument();
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
  });

  it("opens the overseas-card form directly when the purchase screen asks for it", async () => {
    renderScreen({ from: "/subscription/start", addCard: "international" });
    expect(await screen.findByLabelText("카드 번호")).toBeInTheDocument();
  });

  it("shows a 'not available' state instead of the form when nothing is offered", async () => {
    api.internationalCardOptions.mockResolvedValue({ available: false, currencies: [] });
    renderScreen();
    await openForm();
    expect(await screen.findByText("지금은 해외 카드를 등록할 수 없어요")).toBeInTheDocument();
    // A member sent here is billed outside KRW, so a Korean card is no way out.
    expect(screen.getByText("잠시 후 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
  });

  it("formats the number, shows the brand, and blocks a Luhn failure before sending", async () => {
    renderScreen();
    await openForm();
    await userEvent.type(await screen.findByLabelText("카드 번호"), "4242424242424241");
    expect(screen.getByLabelText("카드 번호")).toHaveValue("4242 4242 4242 4241");
    expect(screen.getByText("Visa 카드")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("유효기간 (MM/YY)"), "0731");
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(/카드 번호를 다시 확인해 주세요/)).toBeInTheDocument();
    expect(api.registerInternationalCard).not.toHaveBeenCalled();
  });

  it("rejects an expired or malformed expiry before sending", async () => {
    renderScreen();
    await openForm();
    await fillCard(PAN, "0120");
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(/유효기간이 지난 카드예요/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("유효기간 (MM/YY)"));
    await userEvent.type(screen.getByLabelText("유효기간 (MM/YY)"), "13");
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(/MM\/YY 형식/)).toBeInTheDocument();
    expect(api.registerInternationalCard).not.toHaveBeenCalled();
  });

  it("asks for the birth date only when the currency requires it", async () => {
    api.internationalCardOptions.mockResolvedValue({
      available: true,
      currencies: [{ currency: "USD", requires_holder_birth_date: true, accepted_brands: [] }],
    });
    api.registerInternationalCard.mockResolvedValue({ method: INTL_CARD });
    renderScreen();
    await openForm();
    await fillCard();
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(/생년월일 6자리를 입력해 주세요/)).toBeInTheDocument();
    expect(api.registerInternationalCard).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/생년월일/), "900101");
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await waitFor(() => expect(api.registerInternationalCard).toHaveBeenCalledTimes(1));
    expect(api.registerInternationalCard.mock.calls[0][0].holder_birth_date).toBe("900101");
  });

  it("sends exactly the contract body, then closes and refreshes the wallet", async () => {
    api.registerInternationalCard.mockResolvedValue({ method: INTL_CARD });
    const { qc } = renderScreen();
    await openForm();
    await userEvent.click(await screen.findByRole("radio", { name: "미국 달러(USD)" }));
    await fillCard();
    const listCalls = api.methods.mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await waitFor(() => expect(api.registerInternationalCard).toHaveBeenCalledTimes(1));
    const body = api.registerInternationalCard.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(
      ["card_number", "client_idempotency_key", "currency", "expiry_month", "expiry_year", "recurring_billing_consent"],
    );
    expect(body).toEqual({
      client_idempotency_key: expect.stringMatching(/^.{6,64}$/),
      currency: "USD",
      card_number: PAN,
      expiry_month: 7,
      expiry_year: 2031,
      recurring_billing_consent: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findByText("등록되었어요")).toBeInTheDocument();
    await waitFor(() => expect(api.methods.mock.calls.length).toBeGreaterThan(listCalls));
    // Nothing card-related reached the query cache (queries or mutations).
    const cache = JSON.stringify([
      qc.getQueryCache().getAll().map((q) => [q.queryKey, q.state.data]),
      qc.getMutationCache().getAll().map((m) => m.state.variables),
    ]);
    expect(cache).not.toContain(PAN);
    // Reopening starts from empty fields.
    await openForm();
    expect(await screen.findByLabelText("카드 번호")).toHaveValue("");
    expect(screen.getByLabelText("유효기간 (MM/YY)")).toHaveValue("");
  });

  it("says the card is verified with a cancelled ₩100 charge and needs the recurring-billing agreement", async () => {
    renderScreen();
    await openForm();
    expect(await screen.findByText(/100원.*결제되었다가 바로 취소돼요/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("radio", { name: "미국 달러(USD)" }));
    await fillCard(PAN, "0731", { consent: false });
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(/자동 결제에 동의해야 카드를 등록할 수 있어요/)).toBeInTheDocument();
    expect(api.registerInternationalCard).not.toHaveBeenCalled();
    // The card is still in the form: agreeing is all that is left.
    expect(screen.getByLabelText("카드 번호")).not.toHaveValue("");
  });

  it("never writes card data to web storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    api.registerInternationalCard.mockRejectedValue(new ApiError(422, "payment_method.card_declined", "declined"));
    renderScreen();
    await openForm();
    await fillCard();
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    await screen.findByText(/카드사에서 카드를 승인하지 않았어요/);
    const written = JSON.stringify(setItem.mock.calls);
    expect(written).not.toContain(PAN);
    expect(written).not.toContain("4242 4242");
    expect(written).not.toContain("07/31");
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i++) expect(store.getItem(store.key(i)!)).not.toContain("4242");
    }
    setItem.mockRestore();
  });

  it("clears the card fields after a failure and maps the decline to friendly copy", async () => {
    api.registerInternationalCard.mockRejectedValue(new ApiError(422, "payment_method.card_declined", "Card declined by issuer"));
    renderScreen();
    await openForm();
    await fillCard();
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/카드사에서 카드를 승인하지 않았어요/)).toBeInTheDocument();
    expect(within(alert).getByText(/입력한 카드 정보를 지웠어요/)).toBeInTheDocument();
    expect(screen.getByLabelText("카드 번호")).toHaveValue("");
    expect(screen.getByLabelText("유효기간 (MM/YY)")).toHaveValue("");
    // The server's raw sentence is not what the member reads.
    expect(screen.queryByText(/Card declined by issuer/)).not.toBeInTheDocument();
  });

  it.each([
    [new ApiError(422, "payment_method.invalid_card_number", "x"), /카드 번호가 올바르지 않아요/],
    [new ApiError(422, "payment_method.invalid_card_expiry", "x"), /유효기간이 올바르지 않아요/],
    [new ApiError(422, "payment_method.invalid_card_holder", "x"), /생년월일이 올바르지 않거나/],
    [new ApiError(422, "payment_method.card_not_supported", "x"), /이 카드는 등록할 수 없어요/],
    [new ApiError(422, "payment_method.invalid_intent_state", "x"), /등록을 마치지 못했어요/],
    [new ApiError(429, "rate_limited", "x"), /요청이 너무 많아요/],
    [new ApiError(502, "payment_method.provider_unavailable", "x"), /결제사와 연결이 원활하지 않아요/],
    [
      new ApiError(422, "validation_error", "x", undefined, [{ loc: ["body", "card_number"], type: "value_error", msg: "card number is not valid" }]),
      /카드 번호가 올바르지 않아요/,
    ],
    [
      new ApiError(422, "payment_method.currency_mismatch", "x", { subscription_currency: "USD", card_currency: "KRW" }),
      /이용 중인 구독은 미국 달러\(USD\)로 결제돼요/,
    ],
    [new ApiError(422, "payment_method.unsupported_currency", "x", { available_currencies: ["USD"] }), /선택한 통화는 지금 사용할 수 없어요/],
  ])("maps %s to friendly copy", async (error, text) => {
    api.registerInternationalCard.mockRejectedValue(error);
    renderScreen();
    await openForm();
    await fillCard();
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("swaps to the 'not available' state when the server says it isn't configured", async () => {
    api.registerInternationalCard.mockRejectedValue(new ApiError(503, "payment_method.provider_not_configured", "x"));
    renderScreen();
    await openForm();
    await fillCard();
    await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    expect(await screen.findByText("지금은 해외 카드를 등록할 수 없어요")).toBeInTheDocument();
    expect(screen.queryByLabelText("카드 번호")).not.toBeInTheDocument();
  });

  it("reuses the idempotency key only when the outcome is unknown", async () => {
    api.registerInternationalCard
      .mockRejectedValueOnce(new NetworkError())
      .mockRejectedValueOnce(new ApiError(422, "payment_method.card_declined", "x"))
      .mockResolvedValueOnce({ method: INTL_CARD });
    renderScreen();
    await openForm();
    const submitOnce = async () => {
      await fillCard();
      await userEvent.click(screen.getByRole("button", { name: "등록하기" }));
    };
    await submitOnce();
    await screen.findByText(/결제사와 연결이 원활하지 않아요/);
    await submitOnce();
    await screen.findByText(/카드사에서 카드를 승인하지 않았어요/);
    await submitOnce();
    await waitFor(() => expect(api.registerInternationalCard).toHaveBeenCalledTimes(3));
    const keys = api.registerInternationalCard.mock.calls.map((c) => c[0].client_idempotency_key);
    expect(keys[1]).toBe(keys[0]); // network error → same key
    expect(keys[2]).not.toBe(keys[1]); // after a 4xx → a new key
  });

  it("closing the sheet wipes what was typed", async () => {
    renderScreen();
    await openForm();
    await fillCard();
    // The sheet closes through its backdrop.
    await userEvent.click(document.querySelector(".overlay") as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await openForm();
    expect(await screen.findByLabelText("카드 번호")).toHaveValue("");
  });
});

describe("registered cards show region and currency", () => {
  it("tags each card so domestic and overseas cards can be told apart", async () => {
    api.methods.mockResolvedValue({
      methods: [
        INTL_CARD,
        {
          ...INTL_CARD,
          method_id: "pm_dom",
          provider: "toss_card",
          is_default: false,
          display_name: "Shinhan (5327********0518)",
          issuer: "Shinhan",
          masked_card_number: "5327********0518",
          card_region: "domestic",
          billing_currency: "KRW",
        },
      ],
    });
    renderScreen();
    expect(await screen.findByText("해외 · USD")).toBeInTheDocument();
    expect(screen.getByText("국내 · KRW")).toBeInTheDocument();
  });

  it("greys out a card whose currency can't pay the live plan and explains why", async () => {
    subs.mine.mockResolvedValue({ status: "active", plan_id: "plan_usd", plan_currency: "USD" });
    api.methods.mockResolvedValue({
      methods: [
        INTL_CARD,
        { ...INTL_CARD, method_id: "pm_dom", is_default: false, issuer: "Shinhan", display_name: "Shinhan", card_region: "domestic", billing_currency: "KRW" },
      ],
    });
    renderScreen();
    const locked = await screen.findByLabelText(/Shinhan.*결제 통화가 달라/);
    expect(locked).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(locked);
    expect(api.setDefault).not.toHaveBeenCalled();
    expect(await screen.findByText(/원화\(KRW\)로만 결제돼요. 미국 달러\(USD\) 요금제는 해외 카드로/)).toBeInTheDocument();
  });

  it("maps a currency_mismatch from the domestic intent to friendly copy", async () => {
    api.cardIntent.mockRejectedValue(
      new ApiError(422, "payment_method.currency_mismatch", "raw", { subscription_currency: "USD", card_currency: "KRW" }),
    );
    api.methods.mockResolvedValue({ methods: [], registration: DOMESTIC });
    renderScreen();
    await userEvent.click(await screen.findByLabelText("국내 카드 추가"));
    expect(await screen.findByText(/원화\(KRW\)로만 결제돼요. 미국 달러\(USD\) 요금제는 해외 카드로/)).toBeInTheDocument();
    expect(requestTossBillingAuth).not.toHaveBeenCalled();
  });

  it("maps a server currency_mismatch on set-default to friendly copy", async () => {
    api.methods.mockResolvedValue({
      methods: [INTL_CARD, { ...INTL_CARD, method_id: "pm_eur", is_default: false, issuer: "Other", display_name: "Other", billing_currency: "JPY" }],
    });
    api.setDefault.mockRejectedValue(
      new ApiError(422, "payment_method.currency_mismatch", "raw", { subscription_currency: "USD", card_currency: "JPY" }),
    );
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: /Other.*선택 안 됨/ }));
    expect(await screen.findByText(/이 카드는 엔화\(JPY\)로만 결제돼요/)).toBeInTheDocument();
  });
});
