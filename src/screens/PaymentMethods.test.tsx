import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";
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
  billingApi: {
    recovery: vi.fn(),
    invoice: vi.fn(),
    retryInvoice: vi.fn(),
  },
  subApi: {
    mine: vi.fn(async () => ({ status: "none" })),
    plans: vi.fn(async () => ({ plans: [] })),
  },
}));

const bootstrapMe = vi.fn();
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ bootstrapMe }) }));

// The Toss SDK loads a remote script and navigates away; stub the boundary.
const requestTossBillingAuth = vi.fn();
const requestEasyPayBillingAuth = vi.fn();
vi.mock("../lib/tossPayments", () => ({
  requestTossBillingAuth: (opts: unknown) => requestTossBillingAuth(opts),
  requestEasyPayBillingAuth: (opts: unknown) => requestEasyPayBillingAuth(opts),
  isUserCancel: (e: { code?: string } | null) => e?.code === "USER_CANCEL",
}));

const PENDING_KEY = "hangyul.pm-registration.v2";

// Toss Pay is implemented but not launched. Its flow tests switch it on to
// keep that (unchanged) implementation covered; the rest see the app as shipped.
const launch = vi.hoisted(() => ({ tossPay: false }));
vi.mock("../lib/launch", async () => {
  const actual = await vi.importActual<typeof import("../lib/launch")>("../lib/launch");
  return {
    ...actual,
    isPayLaunched: (p: string) => (p === "toss_pay" ? launch.tossPay : actual.isPayLaunched(p as never)),
  };
});

import { billingApi, payApi } from "../api/endpoints";
import { PaymentMethods } from "./PaymentMethods";

const api = payApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const billing = billingApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const NO_RECOVERY = { recovery_required: false, can_retry_immediately: false };
function setRecovery(rec: Record<string, unknown>) {
  billing.recovery.mockResolvedValue(rec);
}

/* ------------------------------- factories ------------------------------ */
function card(over: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    method_id: "pm_shinhan",
    kind: "card",
    provider: "toss_card",
    status: "active",
    is_default: true,
    display_name: "Shinhan Card (5327********0518)",
    brand: "visa",
    issuer: "Shinhan Card",
    masked_card_number: "5327********0518",
    card_type: "credit",
    ...over,
  };
}
function tossPay(over: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    method_id: "pm_toss",
    kind: "toss_pay",
    provider: "toss_pay",
    status: "active",
    is_default: false,
    display_name: "Toss Pay",
    ...over,
  };
}

/** A +82 member: billed in KRW, registers domestic cards (and the wallets). */
const DOMESTIC = { currency: "KRW", card_region: "domestic" } as const;

function setMethods(...methods: PaymentMethod[]) {
  api.methods.mockResolvedValue({ methods, registration: DOMESTIC });
}

function renderScreen(
  entry = "/account/payment",
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  return render(
    // Assertions below are written against the Korean copy.
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[entry]}>
          <ToastProvider>
            <PaymentMethods />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  launch.tossPay = false; // not launched, as in the app (lib/launch.ts)
  sessionStorage.clear();
  // jsdom doesn't implement scrollIntoView; the screen scrolls its card list
  // after mutations. Stub it so those calls don't throw (matches League.test).
  Element.prototype.scrollIntoView = vi.fn();
  setMethods();
  setRecovery(NO_RECOVERY);
});

/* -------------------------------- tests --------------------------------- */
describe("PaymentMethods screen", () => {
  it("1. renders the empty state: add rows + the Naver Pay connect button + notice, no cards", async () => {
    setMethods();
    renderScreen();
    // A +82 member gets the domestic card button only.
    expect(await screen.findByLabelText("국내 카드 추가")).toBeInTheDocument();
    expect(screen.queryByLabelText("해외 카드 추가")).not.toBeInTheDocument();
    // Toss Pay is implemented but not launched: never offered.
    expect(screen.queryByLabelText("토스페이 연결하기")).not.toBeInTheDocument();
    expect(screen.getByLabelText("네이버페이 연결하기")).toBeInTheDocument();
    expect(screen.getByText("유의사항")).toBeInTheDocument();
    expect(screen.queryByText(/Shinhan/)).not.toBeInTheDocument();
  });

  it("still shows a Toss Pay method already on file, so it can be managed", async () => {
    setMethods(tossPay());
    renderScreen();
    expect(await screen.findByLabelText("토스페이 연결 해제")).toBeInTheDocument();
    expect(screen.queryByLabelText("토스페이 연결하기")).not.toBeInTheDocument();
  });

  it("does not flash the empty layout before the initial fetch resolves", async () => {
    let resolve!: (v: { methods: PaymentMethod[]; registration: typeof DOMESTIC }) => void;
    api.methods.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();
    expect(screen.queryByLabelText("국내 카드 추가")).not.toBeInTheDocument();
    resolve({ methods: [], registration: DOMESTIC });
    expect(await screen.findByLabelText("국내 카드 추가")).toBeInTheDocument();
  });

  it("2. renders one registered card as the selected primary", async () => {
    setMethods(card());
    renderScreen();
    expect(await screen.findByText("Shinhan Card")).toBeInTheDocument();
    expect(screen.getByText("(5327********0518)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Shinhan Card.*선택됨/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("3. + 4. renders multiple cards with exactly one primary radio", async () => {
    setMethods(card(), card({ method_id: "pm_kb", display_name: "KB Card (1111********2222)", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false }));
    renderScreen();
    await screen.findByText("Shinhan Card");
    expect(screen.getByRole("button", { name: /Shinhan Card.*선택됨/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /KB Card.*선택 안 됨/ })).toHaveAttribute("aria-pressed", "false");
    const selected = screen.getAllByRole("button").filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(selected).toHaveLength(1);
  });

  it("5. changes the primary payment method through the API", async () => {
    const shinhan = card();
    const kb = card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false });
    setMethods(shinhan, kb);
    // The server promotes KB; the reconciling refetch must reflect that.
    api.setDefault.mockImplementation(async () => {
      setMethods({ ...shinhan, is_default: false }, { ...kb, is_default: true });
    });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: /KB Card.*선택 안 됨/ }));
    expect(api.setDefault).toHaveBeenCalledWith("pm_kb");
    await waitFor(() => expect(screen.getByRole("button", { name: /KB Card.*선택됨/ })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: /Shinhan Card.*선택 안 됨/ })).toBeInTheDocument());
  });

  it("6. restores the previous primary when the update fails", async () => {
    setMethods(card(), card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false }));
    api.setDefault.mockRejectedValue(new Error("nope"));
    renderScreen();
    const kb = await screen.findByRole("button", { name: /KB Card.*선택 안 됨/ });
    await userEvent.click(kb);
    // rolls back: Shinhan is primary again, KB is not
    await waitFor(() => expect(screen.getByRole("button", { name: /Shinhan Card.*선택됨/ })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /KB Card.*선택 안 됨/ })).toBeInTheDocument();
  });

  it("7. opens and closes the deletion modal", async () => {
    setMethods(card());
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/Shinhan Card.*삭제/));
    expect(screen.getByText("해당 결제수단을 삭제할까요?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByText("해당 결제수단을 삭제할까요?")).not.toBeInTheDocument());
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("8. deletes a non-primary card via the delete API", async () => {
    setMethods(card(), card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false }));
    api.remove.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/KB Card.*삭제/));
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("pm_kb"));
  });

  it("9. deleting the primary hands it to a remaining method (replace)", async () => {
    setMethods(card(), card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false }));
    api.replace.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/Shinhan Card.*삭제/));
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.replace).toHaveBeenCalledWith("pm_shinhan", "pm_kb"));
    expect(api.remove).not.toHaveBeenCalled();
  });

  const walletWindow = (easyPay: "TOSSPAY" | "NAVERPAY", clientKey = "test_ck_w") => ({
    client_key: clientKey,
    easy_pay: easyPay,
    flow_mode: "DIRECT",
    success_url: "https://app/account/payment",
    fail_url: "https://app/account/payment",
  });

  it.each([
    ["토스페이", "tosspayIntent", "toss_pay", "TOSSPAY"],
    ["네이버페이", "naverpayIntent", "naver_pay", "NAVERPAY"],
  ] as const)(
    "10. opens the %s window through Toss's SDK (flowMode DIRECT) and remembers the registration",
    async (name, intent, provider, easyPay) => {
      launch.tossPay = true; // exercises the kept Toss Pay flow
      setMethods();
      api[intent].mockResolvedValue({ intent_id: "pmi_w", customer_key: "cus_w", window: walletWindow(easyPay) });
      requestEasyPayBillingAuth.mockResolvedValue(undefined);
      renderScreen();
      await userEvent.click(await screen.findByLabelText(`${name} 연결하기`));
      await waitFor(() =>
        expect(requestEasyPayBillingAuth).toHaveBeenCalledWith({
          clientKey: "test_ck_w",
          customerKey: "cus_w",
          successUrl: "https://app/account/payment",
          failUrl: "https://app/account/payment",
          easyPay,
        }),
      );
      // Confirmed on the window's return, not now.
      expect(api.tosspayConfirm).not.toHaveBeenCalled();
      expect(api.naverpayConfirm).not.toHaveBeenCalled();
      expect(JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "{}")).toEqual({
        provider,
        intentId: "pmi_w",
        customerKey: "cus_w",
      });
    },
  );

  it("10b. a member closing the wallet window links nothing and shows no error", async () => {
    launch.tossPay = true; // exercises the kept Toss Pay flow
    setMethods();
    api.tosspayIntent.mockResolvedValue({ intent_id: "pmi_1", customer_key: "cus_1", window: walletWindow("TOSSPAY") });
    requestEasyPayBillingAuth.mockRejectedValue({ code: "USER_CANCEL" });
    renderScreen();
    await userEvent.click(await screen.findByLabelText("토스페이 연결하기"));
    await waitFor(() => expect(requestEasyPayBillingAuth).toHaveBeenCalled());
    expect(api.tosspayConfirm).not.toHaveBeenCalled();
    // No toast at all: cancelling is the member's choice, not a failure.
    expect(document.querySelector(".hg-toast-wrap")?.textContent ?? "").toBe("");
  });

  it("10c. without a client key the SDK is never opened; only the manual entry is offered", async () => {
    setMethods();
    api.naverpayIntent.mockResolvedValue({ intent_id: "pmi_1", customer_key: "cus_1", window: walletWindow("NAVERPAY", "") });
    api.naverpayConfirm.mockResolvedValue({ method: tossPay({ provider: "naver_pay", kind: "naver_pay" }) });
    renderScreen();
    await userEvent.click(await screen.findByLabelText("네이버페이 연결하기"));
    await userEvent.type(await screen.findByRole("textbox"), "auth_manual");
    await userEvent.click(screen.getByRole("button", { name: "등록 완료" }));
    await waitFor(() =>
      expect(api.naverpayConfirm).toHaveBeenCalledWith("pmi_1", { authKey: "auth_manual", customerKey: "cus_1" }),
    );
    expect(requestEasyPayBillingAuth).not.toHaveBeenCalled();
  });

  it("11. renders a connected easy-pay provider with radio + delete, other still connectable", async () => {
    setMethods(tossPay({ is_default: false }));
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText(/토스페이, 기본 결제수단/)).toBeInTheDocument());
    expect(screen.getByLabelText("토스페이 연결 해제")).toBeInTheDocument();
    // N Pay is still offered as a connect button
    expect(screen.getByLabelText("네이버페이 연결하기")).toBeInTheDocument();
  });

  it("12. disconnects a connected easy-pay provider", async () => {
    setMethods(card(), tossPay({ is_default: false }));
    api.remove.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByLabelText("토스페이 연결 해제"));
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("pm_toss"));
  });

  it("13. tapping the delete icon does not trigger row primary-selection", async () => {
    setMethods(card({ is_default: false }), card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: true }));
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/Shinhan Card.*삭제/));
    expect(api.setDefault).not.toHaveBeenCalled();
    expect(screen.getByText("해당 결제수단을 삭제할까요?")).toBeInTheDocument();
  });

  it("14. refetches methods after a successful registration flow", async () => {
    setMethods();
    // No client key (card billing not configured): the manual entry is the flow.
    api.cardIntent.mockResolvedValue({ intent_id: "pmi_c", customer_key: "ck", widget: { client_key: "", success_url: "https://w", fail_url: "https://w", card_region: "domestic" } });
    api.cardConfirm.mockResolvedValue({ method: card() });
    renderScreen();
    await screen.findByLabelText("국내 카드 추가");
    const initialCalls = api.methods.mock.calls.length;
    await userEvent.click(screen.getByLabelText("국내 카드 추가"));
    // Domestic only: overseas cards never go through Toss's window.
    expect(api.cardIntent).toHaveBeenCalledWith(expect.any(String));
    await userEvent.type(await screen.findByRole("textbox"), "authkey");
    await userEvent.click(screen.getByRole("button", { name: "등록 완료" }));
    await waitFor(() =>
      expect(api.cardConfirm).toHaveBeenCalledWith("pmi_c", { authKey: "authkey", customerKey: "ck" }),
    );
    await waitFor(() => expect(api.methods.mock.calls.length).toBeGreaterThan(initialCalls));
  });

  it("14b. opens Toss's card window through the SDK with the intent's keys", async () => {
    setMethods();
    const widget = { client_key: "test_ck_x", success_url: "https://app/account/payment", fail_url: "https://app/account/payment", card_region: "domestic" };
    api.cardIntent.mockResolvedValue({ intent_id: "pmi_c", customer_key: "cus_1", widget });
    requestTossBillingAuth.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByLabelText("국내 카드 추가"));
    await waitFor(() =>
      expect(requestTossBillingAuth).toHaveBeenCalledWith({
        clientKey: "test_ck_x",
        customerKey: "cus_1",
        successUrl: widget.success_url,
        failUrl: widget.fail_url,
      }),
    );
    // Remembered for the return, and no manual sheet in the way.
    expect(JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "{}")).toEqual({
      provider: "toss_card",
      intentId: "pmi_c",
      customerKey: "cus_1",
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("14c. confirms a card when Toss returns with an authKey and the same customerKey", async () => {
    setMethods();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: "toss_card", intentId: "pmi_c", customerKey: "cus_1" }));
    api.cardConfirm.mockResolvedValue({ method: card() });
    renderScreen("/account/payment?customerKey=cus_1&authKey=ak_1");
    await waitFor(() =>
      expect(api.cardConfirm).toHaveBeenCalledWith("pmi_c", { authKey: "ak_1", customerKey: "cus_1" }),
    );
    expect(await screen.findByText("등록되었어요")).toBeInTheDocument();
    expect(sessionStorage.getItem(PENDING_KEY)).toBeNull();
  });

  it("14d. shows Toss's failure message and confirms nothing", async () => {
    setMethods();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: "toss_card", intentId: "pmi_c", customerKey: "cus_1" }));
    renderScreen("/account/payment?code=REJECT_CARD_COMPANY&message=%EA%B1%B0%EC%A0%88%EB%90%A8");
    expect(await screen.findByText("거절됨")).toBeInTheDocument();
    expect(api.cardConfirm).not.toHaveBeenCalled();
  });

  it("14e. a window the member cancelled returns quietly", async () => {
    launch.tossPay = true; // exercises the kept Toss Pay flow
    setMethods();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: "toss_pay", intentId: "pmi_t", customerKey: "cus_1" }));
    renderScreen("/account/payment?code=PAY_PROCESS_CANCELED&message=%EC%B7%A8%EC%86%8C%EB%90%A8");
    await screen.findByLabelText("토스페이 연결하기");
    expect(screen.queryByText("취소됨")).not.toBeInTheDocument();
    expect(api.tosspayConfirm).not.toHaveBeenCalled();
  });

  it.each([
    ["toss_pay", "tosspayConfirm"],
    ["naver_pay", "naverpayConfirm"],
  ] as const)("14f. confirms %s on the window's return", async (provider, confirm) => {
    setMethods();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider, intentId: "pmi_w", customerKey: "cus_w" }));
    api[confirm].mockResolvedValue({ method: tossPay({ provider, kind: provider }) });
    renderScreen("/account/payment?customerKey=cus_w&authKey=ak_w");
    await waitFor(() => expect(api[confirm]).toHaveBeenCalledWith("pmi_w", { authKey: "ak_w", customerKey: "cus_w" }));
    expect(api.cardConfirm).not.toHaveBeenCalled();
  });

  it("14g. refuses a return for another customerKey than the window was opened with", async () => {
    setMethods();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ provider: "naver_pay", intentId: "pmi_n", customerKey: "cus_mine" }));
    renderScreen("/account/payment?customerKey=cus_someone_else&authKey=ak_x");
    expect(await screen.findByText("결제수단을 등록하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    expect(api.naverpayConfirm).not.toHaveBeenCalled();
  });

  it("9b. deleting the primary never hands it to a revoked method", async () => {
    setMethods(card(), card({ method_id: "pm_old", status: "revoked", is_default: false, display_name: "Old", issuer: "Old", masked_card_number: "0000********0000" }));
    api.remove.mockResolvedValue(undefined);
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/Shinhan Card.*삭제/));
    await userEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("pm_shinhan"));
    expect(api.replace).not.toHaveBeenCalled();
  });

  it("15. prevents duplicate delete submissions while one is in-flight", async () => {
    setMethods(card({ is_default: false }));
    let resolve!: () => void;
    api.remove.mockReturnValue(new Promise<void>((r) => { resolve = () => r(); }));
    renderScreen();
    await userEvent.click(await screen.findByLabelText(/Shinhan Card.*삭제/));
    const del = screen.getByRole("button", { name: "삭제" });
    await userEvent.click(del);
    await userEvent.click(del); // second click while pending must be ignored
    expect(api.remove).toHaveBeenCalledTimes(1);
    resolve();
  });
});

/* ------------------ failed-automatic-payment recovery flow ---------------- */
const RECOVERY = {
  recovery_required: true,
  can_retry_immediately: true,
  outstanding_invoice_id: "inv_1",
  failure_class: "insufficient_funds",
  failure_code: "DECLINED",
  next_automatic_retry_at: "2026-07-16T00:41:00Z",
  plan_id: "plan_monthly",
  plan_name: "프리미엄",
};

describe("PaymentMethods recovery flow", () => {
  it("R1. shows the notice when recovery is required", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    renderScreen();
    expect(await screen.findByRole("alert", { name: "자동 결제 실패 안내" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 바로 구독료 결제하기" })).toBeInTheDocument();
  });

  it("R2. hides the notice when there is no outstanding payment", async () => {
    setMethods(card());
    setRecovery(NO_RECOVERY);
    renderScreen();
    await screen.findByText("Shinhan Card");
    expect(screen.queryByRole("alert", { name: "자동 결제 실패 안내" })).not.toBeInTheDocument();
  });

  it("R2b. keeps the notice but disables retry, explaining why, when the limits refuse it", async () => {
    setMethods(card());
    setRecovery({
      ...RECOVERY,
      can_retry_immediately: false,
      retry_blocked_reason: "cooldown",
      retry_available_at: "2026-07-16T00:41:00Z",
    });
    renderScreen();
    expect(await screen.findByRole("alert", { name: "자동 결제 실패 안내" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "지금 바로 구독료 결제하기" })).toBeDisabled();
    expect(screen.getByText(/방금 이 카드로 결제를 시도했어요/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(billing.retryInvoice).not.toHaveBeenCalled();
  });

  it("R2c. asks for another method when the current one cannot be charged", async () => {
    setMethods(card());
    setRecovery({ ...RECOVERY, can_retry_immediately: false, retry_blocked_reason: "method_unusable" });
    renderScreen();
    expect(await screen.findByText(/다른 결제수단을 추가하거나 선택해 주세요/)).toBeInTheDocument();
  });

  it("R3. maps the failure reason to safe Korean copy", async () => {
    setMethods(card());
    setRecovery({ ...RECOVERY, failure_class: "card_expired" });
    renderScreen();
    expect(
      await screen.findByText(/유효기간이 만료되어 결제가 되지 않았어요/),
    ).toBeInTheDocument();
    // never leaks the raw code
    expect(screen.queryByText(/DECLINED/)).not.toBeInTheDocument();
  });

  it("R4/R5. renders the next retry date, omits it when absent", async () => {
    setMethods(card());
    setRecovery({ ...RECOVERY, next_automatic_retry_at: null });
    const { unmount } = renderScreen();
    await screen.findByRole("alert", { name: "자동 결제 실패 안내" });
    expect(screen.queryByText(/다음 자동 결제 시도일/)).not.toBeInTheDocument();
    unmount();

    setRecovery(RECOVERY);
    renderScreen();
    expect(await screen.findByText(/다음 자동 결제 시도일:/)).toBeInTheDocument();
  });

  it("R6. retry targets the outstanding invoice and shows the success modal", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    billing.retryInvoice.mockResolvedValue({ attempt_id: "pa_1", queued_at: "x" });
    billing.invoice.mockResolvedValue({ invoice: { status: "paid" }, payments: [] });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(billing.retryInvoice).toHaveBeenCalledWith("inv_1");
    expect(await screen.findByRole("dialog", { name: "결제 완료" })).toBeInTheDocument();
    expect(screen.getByText("결제가 완료됐어요")).toBeInTheDocument();
  });

  it("R7. blocks retry while a primary-method change is pending", async () => {
    setMethods(card(), card({ method_id: "pm_kb", display_name: "KB Card", issuer: "KB Card", masked_card_number: "1111********2222", is_default: false }));
    setRecovery(RECOVERY);
    let resolveSet!: () => void;
    api.setDefault.mockReturnValue(new Promise<void>((r) => { resolveSet = () => r(); }));
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: /KB Card.*선택 안 됨/ }));
    // retry button is disabled while the primary change is in flight
    expect(screen.getByRole("button", { name: "지금 바로 구독료 결제하기" })).toBeDisabled();
    expect(billing.retryInvoice).not.toHaveBeenCalled();
    resolveSet();
  });

  it("R8. prevents duplicate retry submissions", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    let resolve!: () => void;
    billing.retryInvoice.mockReturnValue(new Promise((r) => { resolve = () => r({ attempt_id: "pa", queued_at: "x" }); }));
    renderScreen();
    const btn = await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" });
    await userEvent.click(btn);
    await userEvent.click(btn); // ignored while in-flight
    expect(billing.retryInvoice).toHaveBeenCalledTimes(1);
    resolve();
  });

  it("R9. shows a loading state on the retry button", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    let resolve!: () => void;
    billing.retryInvoice.mockReturnValue(new Promise((r) => { resolve = () => r({ attempt_id: "pa", queued_at: "x" }); }));
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByText("결제 중...")).toBeInTheDocument();
    resolve();
  });

  it("R12/R13. confirming success closes the modal and refreshes entitlement", async () => {
    setMethods(card());
    // required → then cleared after success
    billing.recovery.mockResolvedValueOnce(RECOVERY).mockResolvedValue(NO_RECOVERY);
    billing.retryInvoice.mockResolvedValue({ attempt_id: "pa", queued_at: "x" });
    billing.invoice.mockResolvedValue({ invoice: { status: "paid" }, payments: [] });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    await userEvent.click(await screen.findByRole("button", { name: "결제 완료 확인" }));
    await waitFor(() => expect(bootstrapMe).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결제 완료" })).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("alert", { name: "자동 결제 실패 안내" })).not.toBeInTheDocument(),
    );
  });

  it("R13b. a recovered payment refreshes the premium-gated data", async () => {
    // Regression: only the wallet, the recovery notice and /users/me were
    // refreshed, but premium gating reads the subscription and the dashboard
    // (paywall_required), so locked content stayed locked after paying.
    setMethods(card());
    billing.recovery.mockResolvedValueOnce(RECOVERY).mockResolvedValue(NO_RECOVERY);
    billing.retryInvoice.mockResolvedValue({ attempt_id: "pa", queued_at: "x" });
    billing.invoice.mockResolvedValue({ invoice: { status: "paid" }, payments: [] });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(["dashboard"], { paywall_required: true });
    qc.setQueryData(["invoices-inf"], { pages: [], pageParams: [] });
    renderScreen("/account/payment", qc);
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    await screen.findByRole("dialog", { name: "결제 완료" });
    expect(qc.getQueryState(["dashboard"])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["invoices-inf"])?.isInvalidated).toBe(true);
  });

  it("R14/R15/R16. failed retry shows a safe failure modal and keeps the notice", async () => {
    setMethods(card());
    setRecovery({ ...RECOVERY, failure_class: "insufficient_funds" });
    billing.retryInvoice.mockResolvedValue({ attempt_id: "pa", queued_at: "x" });
    billing.invoice.mockResolvedValue({ invoice: { status: "open" }, payments: [] });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByRole("dialog", { name: "결제 실패" })).toBeInTheDocument();
    expect(screen.getByText(/잔액 부족으로 결제가 진행되지 않았어요/)).toBeInTheDocument();
    // action closes the modal without auto-retry or auto primary change
    await userEvent.click(screen.getByRole("button", { name: "다른 결제수단 선택하기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "결제 실패" })).not.toBeInTheDocument());
    expect(billing.retryInvoice).toHaveBeenCalledTimes(1);
    expect(api.setDefault).not.toHaveBeenCalled();
    expect(screen.getByRole("alert", { name: "자동 결제 실패 안내" })).toBeInTheDocument();
  });

  it("R18. retry without a usable primary method does not call the payment API", async () => {
    // No default among the methods → no usable primary.
    setMethods(card({ is_default: false }));
    setRecovery(RECOVERY);
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(billing.retryInvoice).not.toHaveBeenCalled();
  });

  it("R20/R21. already-paid (409) is verified and treated as success", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    const err = Object.assign(new Error("paid"), { status: 409 });
    Object.setPrototypeOf(err, (await import("../lib/http")).ApiError.prototype);
    billing.retryInvoice.mockRejectedValue(err);
    billing.invoice.mockResolvedValue({ invoice: { status: "paid" }, payments: [] });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByRole("dialog", { name: "결제 완료" })).toBeInTheDocument();
  });

  it("a charge still in progress (409 charge_in_progress) is pending, never a success", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    const { ApiError } = await import("../lib/http");
    billing.retryInvoice.mockRejectedValue(
      new ApiError(409, "billing.charge_in_progress", "The last payment for this invoice is still being processed."),
    );
    billing.invoice.mockResolvedValue({ invoice: { status: "open" }, payments: [] });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByText(/결제 결과를 확인하고 있어요/)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "결제 완료" })).not.toBeInTheDocument();
    expect(billing.invoice).not.toHaveBeenCalled();
  });

  it("a retry refused by the daily limit (429) is explained, not read as paid", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    const { ApiError } = await import("../lib/http");
    billing.retryInvoice.mockRejectedValue(
      new ApiError(429, "billing.retry_limit_reached", "too many", {
        reason: "daily_limit",
        retry_after: "2026-07-16T00:41:00Z",
      }),
    );
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByText(/오늘 이 결제를 여러 번 다시 시도했어요/)).toBeInTheDocument();
    expect(billing.invoice).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "결제 완료" })).not.toBeInTheDocument();
  });

  it("a 409 that the method needs replacing is explained, not verified as paid", async () => {
    setMethods(card());
    setRecovery(RECOVERY);
    const { ApiError } = await import("../lib/http");
    billing.retryInvoice.mockRejectedValue(
      new ApiError(409, "billing.retry_needs_new_method", "no", { reason: "method_unusable" }),
    );
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: "지금 바로 구독료 결제하기" }));
    expect(await screen.findByText(/다른 결제수단을 추가하거나 선택해 주세요/)).toBeInTheDocument();
    expect(billing.invoice).not.toHaveBeenCalled();
  });
});
