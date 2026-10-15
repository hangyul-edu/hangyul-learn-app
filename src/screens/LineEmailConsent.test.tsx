/**
 * LINE's email notice: the LINE button opens it instead of leaving for LINE;
 * only its consent button starts the LINE sign-in, X goes back without one,
 * and the Privacy Policy opens over it. Not the sign-up terms.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ko } from "../i18n/locales/ko";
import { en } from "../i18n/locales/en";
import { policyDoc } from "../lib/policies";
import { Welcome } from "./Welcome";
import { LineEmailConsent, LINE_EMAIL_CONSENT_PATH } from "./LineEmailConsent";

const start = vi.fn();
vi.mock("../hooks/socialLogin", () => ({ useSocialLogin: () => ({ start }) }));

function Loc() {
  return <span data-testid="loc">{useLocation().pathname}</span>;
}

function renderFrom(path: string, language: "ko" | "en" = "ko") {
  return render(
    <I18nProvider language={language}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path={LINE_EMAIL_CONSENT_PATH} element={<LineEmailConsent />} />
        </Routes>
        <Loc />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  start.mockReset();
  start.mockResolvedValue(undefined);
});

describe("LINE email notice", () => {
  it("the LINE button opens the notice without starting LINE", async () => {
    renderFrom("/welcome");
    await userEvent.click(screen.getByLabelText(ko.welcome.line));
    expect(screen.getByTestId("loc")).toHaveTextContent(LINE_EMAIL_CONSENT_PATH);
    expect(screen.getByRole("heading", { name: ko.lineConsent.title })).toBeInTheDocument();
    expect(screen.getByText(ko.lineConsent.description)).toBeInTheDocument();
    expect(start).not.toHaveBeenCalled();
  });

  it("the other providers still start straight away", async () => {
    renderFrom("/welcome");
    await userEvent.click(screen.getByLabelText(ko.welcome.kakao));
    expect(start).toHaveBeenCalledWith("kakao");
    expect(screen.getByTestId("loc")).toHaveTextContent("/welcome");
  });

  it("the consent button starts the LINE sign-in", async () => {
    renderFrom("/welcome");
    await userEvent.click(screen.getByLabelText(ko.welcome.line));
    await userEvent.click(screen.getByRole("button", { name: ko.lineConsent.agree }));
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith("line");
  });

  it("X returns to the previous screen without starting LINE", async () => {
    renderFrom("/welcome");
    await userEvent.click(screen.getByLabelText(ko.welcome.line));
    await userEvent.click(screen.getByLabelText(ko.lineConsent.closeA11y));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(start).not.toHaveBeenCalled();
  });

  it("X on a directly opened notice goes to the welcome screen", async () => {
    renderFrom(LINE_EMAIL_CONSENT_PATH);
    await userEvent.click(screen.getByLabelText(ko.lineConsent.closeA11y));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/welcome"));
    expect(start).not.toHaveBeenCalled();
  });

  it("the Privacy Policy opens over the notice", async () => {
    renderFrom(LINE_EMAIL_CONSENT_PATH);
    await userEvent.click(screen.getByRole("button", { name: ko.lineConsent.privacyPolicy }));
    expect(await screen.findByText(policyDoc("ko", "purchase-privacy").title)).toBeInTheDocument();
    expect(screen.getByTestId("loc")).toHaveTextContent(LINE_EMAIL_CONSENT_PATH);
    expect(start).not.toHaveBeenCalled();
  });

  it("is in English too", () => {
    renderFrom(LINE_EMAIL_CONSENT_PATH, "en");
    expect(screen.getByRole("heading", { name: en.lineConsent.title })).toBeInTheDocument();
    expect(screen.getByText(en.lineConsent.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.lineConsent.privacyPolicy })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en.lineConsent.agree })).toBeInTheDocument();
  });
});
