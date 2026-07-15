import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { PaymentMethod } from "../lib/types";

// Mock only the network boundary — the tests never hit a real backend.
vi.mock("../api/endpoints", () => ({
  payApi: {
    methods: vi.fn(),
    cardIntent: vi.fn(),
    cardConfirm: vi.fn(),
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
}));

const bootstrapMe = vi.fn();
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ bootstrapMe }) }));

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

function setMethods(...methods: PaymentMethod[]) {
  api.methods.mockResolvedValue({ methods });
}

function renderScreen() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider>
          <PaymentMethods />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  setMethods();
  setRecovery(NO_RECOVERY);
});

/* -------------------------------- tests --------------------------------- */
describe("PaymentMethods screen", () => {
  it("1. renders the empty state: add rows + both connect buttons + notice, no cards", async () => {
    setMethods();
    renderScreen();
    expect(await screen.findByLabelText("국내 카드 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("해외 카드 추가")).toBeInTheDocument();
    expect(screen.getByLabelText("토스페이 연결하기")).toBeInTheDocument();
    expect(screen.getByLabelText("네이버페이 연결하기")).toBeInTheDocument();
    expect(screen.getByText("유의사항")).toBeInTheDocument();
    expect(screen.queryByText(/Shinhan/)).not.toBeInTheDocument();
  });

  it("does not flash the empty layout before the initial fetch resolves", async () => {
    let resolve!: (v: { methods: PaymentMethod[] }) => void;
    api.methods.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();
    expect(screen.queryByLabelText("국내 카드 추가")).not.toBeInTheDocument();
    resolve({ methods: [] });
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

  it("10. connects an easy-payment provider (Toss Pay)", async () => {
    setMethods();
    api.tosspayIntent.mockResolvedValue({ intent_id: "pmi_1", authorize_url: "https://pay/x", customer_key: "ck" });
    api.tosspayConfirm.mockResolvedValue({ method: tossPay() });
    renderScreen();
    await userEvent.click(await screen.findByLabelText("토스페이 연결하기"));
    expect(api.tosspayIntent).toHaveBeenCalledTimes(1);
    await userEvent.type(await screen.findByRole("textbox"), "code123");
    await userEvent.click(screen.getByRole("button", { name: "등록 완료" }));
    await waitFor(() => expect(api.tosspayConfirm).toHaveBeenCalledWith("pmi_1", "code123", "pmi_1"));
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
    api.cardIntent.mockResolvedValue({ intent_id: "pmi_c", customer_key: "ck", widget: { client_key: "test_ck_domestic", success_url: "https://w", fail_url: "https://f", card_region: "domestic" } });
    api.cardConfirm.mockResolvedValue({ method: card() });
    renderScreen();
    await screen.findByLabelText("국내 카드 추가");
    const initialCalls = api.methods.mock.calls.length;
    await userEvent.click(screen.getByLabelText("국내 카드 추가"));
    expect(api.cardIntent).toHaveBeenCalledWith(expect.any(String), "domestic");
    await userEvent.type(await screen.findByRole("textbox"), "authkey");
    await userEvent.click(screen.getByRole("button", { name: "등록 완료" }));
    await waitFor(() => expect(api.cardConfirm).toHaveBeenCalledWith("pmi_c", "authkey"));
    await waitFor(() => expect(api.methods.mock.calls.length).toBeGreaterThan(initialCalls));
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

  it("R2b. hides the notice when immediate retry is not allowed", async () => {
    setMethods(card());
    setRecovery({ ...RECOVERY, can_retry_immediately: false });
    renderScreen();
    await screen.findByText("Shinhan Card");
    expect(screen.queryByRole("alert", { name: "자동 결제 실패 안내" })).not.toBeInTheDocument();
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
});
