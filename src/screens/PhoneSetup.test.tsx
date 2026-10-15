/**
 * The phone steps on the phone-change screen:
 *
 * - **Sign-up** (/signup/phone): a first social sign-in that matched no
 *   account by email. No account and no session exist; the verified number
 *   signs in to the account holding it, or only then creates one.
 * - **Setup** (/setup/phone): an older social account without a number.
 *
 * Neither can be skipped; saving continues the signup instead of going back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ko } from "../i18n/locales/ko";

const { auth, toast } = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), show: vi.fn() },
  auth: {
    me: null as null | Record<string, unknown>,
    setMe: vi.fn(),
    bootstrapMe: vi.fn(),
    revokeSession: vi.fn(),
    hardSignOut: vi.fn(),
    applyTokens: vi.fn(),
  },
}));
vi.mock("../api/endpoints", () => ({
  authApi: { startPhone: vi.fn(), confirmPhone: vi.fn(), changePhone: vi.fn(), completeSocialSignup: vi.fn() },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => auth }));
vi.mock("../hooks/toast", () => ({ useToast: () => toast }));

import { authApi } from "../api/endpoints";
import { ApiError } from "../lib/http";
import { loadPendingSignup, savePendingSignup } from "../hooks/socialSignup";
import { ChangePhone } from "./AccountChanges";

const api = authApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderStep(path = "/setup/phone") {
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/account", path]} initialIndex={1}>
          <Routes>
            <Route path="/setup/phone" element={<ChangePhone mode="setup" />} />
            <Route path="/signup/phone" element={<ChangePhone mode="signup" />} />
            <Route path="*" element={<Loc />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function verifyAndSave(local: string) {
  const user = userEvent.setup();
  await user.type(document.querySelector<HTMLInputElement>(".pchg__phone")!, local);
  await user.click(screen.getByRole("button", { name: ko.accountChanges.requestCodeA11y }));
  await user.type(document.querySelector<HTMLInputElement>(".pchg__code")!, "123456");
  await user.click(document.querySelector<HTMLButtonElement>(".pchg__confirm")!);
  await waitFor(() => expect(document.querySelector(".pchg__submit")).toBeEnabled());
  await user.click(document.querySelector<HTMLButtonElement>(".pchg__submit")!);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  auth.me = { phone: null, nationality: null, nickname: null, phone_verification_pending: true };
  const later = new Date(Date.now() + 180_000).toISOString();
  api.startPhone.mockResolvedValue({ verification_id: "v1", expires_at: later, resend_available_at: later });
  api.confirmPhone.mockResolvedValue({ verification_token: "tok" });
  api.changePhone.mockResolvedValue({ phone: "+821012345678" });
  auth.revokeSession.mockResolvedValue(undefined);
});

describe("ChangePhone in setup mode", () => {
  it("asks for the number without explaining what it is used for", () => {
    renderStep();
    expect(screen.getByRole("heading")).toHaveTextContent(ko.phoneSetup.title);
    expect(screen.getByText(ko.phoneSetup.intro)).toBeInTheDocument();
    expect(screen.queryByText(/결제 통화|계정을 찾을/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ko.common.back })).not.toBeInTheDocument();
  });

  it("saves the verified number and continues to the profile", async () => {
    auth.bootstrapMe.mockResolvedValue({
      phone: "+821012345678", nickname: null, phone_verification_pending: false, terms_agreement_pending: false,
    });
    renderStep();
    await verifyAndSave("01012345678");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/setup/profile"));
    // A first number: the SMS speaks of registering one, not changing it.
    expect(api.startPhone).toHaveBeenCalledWith("+821012345678", "add_phone");
    expect(api.changePhone).toHaveBeenCalledWith("+821012345678", "tok", "KR");
    expect(auth.bootstrapMe).toHaveBeenCalled();
  });

  it("goes home when the profile and onboarding are already done", async () => {
    auth.bootstrapMe.mockResolvedValue({
      phone: "+821012345678", nickname: "me", onboarding_completed: true, phone_verification_pending: false,
    });
    renderStep();
    await verifyAndSave("01012345678");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/home"));
  });

  it("leaving signs out instead of skipping the step", async () => {
    renderStep();
    await userEvent.click(screen.getByRole("button", { name: ko.phoneSetup.quitA11y }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(auth.revokeSession).toHaveBeenCalled();
    expect(auth.hardSignOut).toHaveBeenCalled();
    expect(api.changePhone).not.toHaveBeenCalled();
  });
});

describe("ChangePhone in sign-up mode (no account yet)", () => {
  const session = (overrides: Record<string, unknown>) => ({
    access_token: "a1", refresh_token: "r1", token_type: "bearer", expires_in: 900,
    user_id: "user_x", is_new_user: true, next_step: "terms_agreement", membership: null, ...overrides,
  });

  beforeEach(() => {
    auth.me = null; // no session during the sign-up's phone step
    savePendingSignup({ signup_token: "ticket", provider: "line", expires_in: 1800, next_step: "phone_verification" });
  });

  it("creates the account only now and continues to the terms", async () => {
    api.completeSocialSignup.mockResolvedValue(session({}));
    auth.bootstrapMe.mockResolvedValue({ phone: "+821012345678", terms_agreement_pending: true, nickname: null });
    renderStep("/signup/phone");
    await verifyAndSave("01012345678");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/signup/terms"));
    expect(api.startPhone).toHaveBeenCalledWith("+821012345678", "add_phone");
    expect(api.completeSocialSignup).toHaveBeenCalledWith("ticket", "+821012345678", "tok", "KR");
    expect(api.changePhone).not.toHaveBeenCalled();
    expect(auth.applyTokens).toHaveBeenCalledWith(expect.objectContaining({ access_token: "a1" }), true);
    expect(toast.success).not.toHaveBeenCalled();
    expect(loadPendingSignup()).toBeNull(); // the ticket is spent
  });

  it("a member's number signs in to their account", async () => {
    api.completeSocialSignup.mockResolvedValue(session({ is_new_user: false, next_step: "home", user_id: "user_member" }));
    auth.bootstrapMe.mockResolvedValue({
      user_id: "user_member", phone: "+821012345678", nickname: "member", onboarding_completed: true,
      phone_verification_pending: false, terms_agreement_pending: false,
    });
    renderStep("/signup/phone");
    await verifyAndSave("01012345678");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/home"));
    expect(toast.success).toHaveBeenCalledWith(ko.phoneSetup.linked);
  });

  it("an expired sign-up starts over from the welcome screen", async () => {
    api.completeSocialSignup.mockRejectedValue(new ApiError(410, "social_signup_expired", "expired"));
    renderStep("/signup/phone");
    await verifyAndSave("01012345678");
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(toast.error).toHaveBeenCalled();
    expect(loadPendingSignup()).toBeNull();
  });

  it("a refused number keeps the sign-up so another can be tried", async () => {
    api.completeSocialSignup.mockRejectedValue(
      new ApiError(409, "phone_already_registered", "x", { reason: "provider_already_linked" }),
    );
    renderStep("/signup/phone");
    await verifyAndSave("01012345678");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByTestId("loc")).not.toBeInTheDocument();
    expect(loadPendingSignup()).not.toBeNull();
  });

  it("leaving drops the sign-up; there is no session to end", async () => {
    renderStep("/signup/phone");
    await userEvent.click(screen.getByRole("button", { name: ko.phoneSetup.quitA11y }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(auth.revokeSession).not.toHaveBeenCalled();
    expect(loadPendingSignup()).toBeNull();
  });

  it("without a sign-up in progress it goes back to the welcome screen", () => {
    window.sessionStorage.clear();
    renderStep("/signup/phone");
    expect(screen.getByTestId("loc")).toHaveTextContent("/welcome");
  });
});
