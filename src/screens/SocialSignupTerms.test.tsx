/**
 * Social signup's terms step: the same agreements, in the same words, as email
 * signup; Next is enabled only by the four required ones, sends all seven, and
 * moves on to profile registration; X signs out.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";
import { ko } from "../i18n/locales/ko";

const { agreeSocialTerms, setMe, revokeSession, hardSignOut } = vi.hoisted(() => ({
  agreeSocialTerms: vi.fn(),
  setMe: vi.fn(),
  revokeSession: vi.fn(),
  hardSignOut: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({ authApi: { agreeSocialTerms } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ setMe, revokeSession, hardSignOut }) }));

import { SocialSignupTerms } from "./SocialSignupTerms";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderScreen() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider language="ko">
        <ToastProvider>
          <MemoryRouter initialEntries={["/signup/terms"]}>
            <Routes>
              <Route path="/signup/terms" element={<SocialSignupTerms />} />
              <Route path="*" element={<Loc />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const REQUIRED = [ko.signup.agreeAge, ko.signup.agreeTerms, ko.signup.agreePrivacy, ko.signup.agreeThird];
const OPTIONAL = [ko.signup.agreeMarketing, ko.signup.agreeServiceNotice, ko.signup.agreeAdNotice];

beforeEach(() => {
  vi.clearAllMocks();
  agreeSocialTerms.mockResolvedValue({ next_step: "profile_registration" });
  revokeSession.mockResolvedValue(undefined);
});

describe("SocialSignupTerms", () => {
  it("lists email signup's seven agreements in the same words", () => {
    renderScreen();
    expect(screen.getByRole("heading").textContent).toBe(ko.socialTerms.title);
    for (const label of [...REQUIRED, ...OPTIONAL]) {
      expect(screen.getByRole("checkbox", { name: label })).toHaveAttribute("aria-checked", "false");
    }
    expect(screen.getByRole("checkbox", { name: ko.signup.agreeAll })).toBeInTheDocument();
  });

  it("enables Next only once every required agreement is ticked", async () => {
    renderScreen();
    const next = screen.getByRole("button", { name: ko.socialTerms.next });
    expect(next).toBeDisabled();
    for (const label of REQUIRED.slice(0, 3)) await userEvent.click(screen.getByRole("checkbox", { name: label }));
    expect(next).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: REQUIRED[3] }));
    expect(next).toBeEnabled();
  });

  it("sends the agreements and goes on to profile registration", async () => {
    renderScreen();
    for (const label of REQUIRED) await userEvent.click(screen.getByRole("checkbox", { name: label }));
    await userEvent.click(screen.getByRole("checkbox", { name: ko.signup.agreeServiceNotice }));
    await userEvent.click(screen.getByRole("button", { name: ko.socialTerms.next }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/setup/profile"));
    expect(agreeSocialTerms).toHaveBeenCalledWith({
      age_consent: true,
      terms_accepted: true,
      privacy_accepted: true,
      third_party_accepted: true,
      marketing_opt_in: false,
      service_notification_opt_in: true,
      ad_notification_opt_in: false,
    });
    expect(setMe).toHaveBeenCalled();
  });

  it("goes on to the phone step when the provider gave no phone number", async () => {
    agreeSocialTerms.mockResolvedValue({ next_step: "phone_verification" });
    renderScreen();
    for (const label of REQUIRED) await userEvent.click(screen.getByRole("checkbox", { name: label }));
    await userEvent.click(screen.getByRole("button", { name: ko.socialTerms.next }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/setup/phone"));
  });

  it("agree-to-all ticks and unticks every row", async () => {
    renderScreen();
    const all = screen.getByRole("checkbox", { name: ko.signup.agreeAll });
    await userEvent.click(all);
    for (const label of [...REQUIRED, ...OPTIONAL]) {
      expect(screen.getByRole("checkbox", { name: label })).toHaveAttribute("aria-checked", "true");
    }
    expect(screen.getByRole("button", { name: ko.socialTerms.next })).toBeEnabled();
    await userEvent.click(all);
    expect(screen.getByRole("checkbox", { name: REQUIRED[0] })).toHaveAttribute("aria-checked", "false");
  });

  it("opens the full document from a row's arrow", async () => {
    renderScreen();
    await userEvent.click(
      screen.getByRole("button", { name: ko.signup.viewDetailA11y.replace("{name}", ko.signup.agreeTerms) }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("closing signs out and returns to the welcome screen", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: ko.socialTerms.closeA11y }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(revokeSession).toHaveBeenCalled();
    expect(hardSignOut).toHaveBeenCalled();
    expect(agreeSocialTerms).not.toHaveBeenCalled();
  });
});
