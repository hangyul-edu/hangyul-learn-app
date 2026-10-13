/**
 * Social signup's phone step (/setup/phone): the phone-change screen in setup
 * mode. It says why the number is needed, cannot be skipped (X signs out, as
 * on the terms step), and saving continues the signup instead of going back.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ko } from "../i18n/locales/ko";

const { auth } = vi.hoisted(() => ({
  auth: {
    me: null as null | Record<string, unknown>,
    setMe: vi.fn(),
    bootstrapMe: vi.fn(),
    revokeSession: vi.fn(),
    hardSignOut: vi.fn(),
  },
}));
vi.mock("../api/endpoints", () => ({ authApi: { startPhone: vi.fn(), confirmPhone: vi.fn(), changePhone: vi.fn() } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => auth }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { authApi } from "../api/endpoints";
import { ChangePhone } from "./AccountChanges";

const api = authApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderStep() {
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/account", "/setup/phone"]} initialIndex={1}>
          <Routes>
            <Route path="/setup/phone" element={<ChangePhone mode="setup" />} />
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
