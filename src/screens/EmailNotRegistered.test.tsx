/**
 * An account without a real email — a social sign-up whose provider gave none
 * (the server keeps a generated placeholder and reports `email: null`) — is
 * shown as "not registered", never as an address.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ko } from "../i18n/locales/ko";
import { en } from "../i18n/locales/en";

const { auth } = vi.hoisted(() => ({ auth: { me: null as null | Record<string, unknown> } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => auth }));

import { Account } from "./Account";
import { FindEmailResult } from "./FindEmailResult";

function emailField(): HTMLElement {
  return document.querySelector<HTMLElement>('[aria-labelledby="acct-email-label"]')!;
}

describe("Account management", () => {
  it.each([
    ["ko", ko.common.notRegistered],
    ["en", en.common.notRegistered],
  ] as const)("shows %s 'not registered' for an account without an email", (language, text) => {
    auth.me = { name: "회원", phone: "+821012345678", email: null };
    render(
      <I18nProvider language={language}>
        <MemoryRouter>
          <Account />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(emailField()).toHaveTextContent(text);
    expect(emailField().textContent).not.toContain("@");
  });

  it("shows a real email as it is", () => {
    auth.me = { name: "회원", phone: "+821012345678", email: "me@talkhangyul.co.kr" };
    render(
      <I18nProvider language="ko">
        <MemoryRouter>
          <Account />
        </MemoryRouter>
      </I18nProvider>,
    );
    expect(emailField()).toHaveTextContent("me@talkhangyul.co.kr");
  });
});

describe("Find email result", () => {
  function renderResult(state: unknown) {
    return render(
      <I18nProvider language="ko">
        <MemoryRouter initialEntries={[{ pathname: "/find-email/result", state }]}>
          <Routes>
            <Route path="/find-email/result" element={<FindEmailResult />} />
            <Route path="/forgot" element={<p>lookup form</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );
  }

  it("an account without an email is found, its email not registered", () => {
    renderResult({ found: true, email: null });
    expect(screen.getByRole("heading")).toHaveTextContent(ko.findEmailResult.noEmailTitle);
    expect(screen.getByText(ko.common.notRegistered)).toBeInTheDocument();
  });

  it("a found email is shown masked, as the server sent it", () => {
    renderResult({ found: true, email: "m*@talkhangyul.co.kr" });
    expect(screen.getByRole("heading")).toHaveTextContent(ko.findEmailResult.title);
    expect(screen.getByText("m*@talkhangyul.co.kr")).toBeInTheDocument();
  });

  it("without a lookup result it goes back to the form", () => {
    renderResult(null);
    expect(screen.getByText("lookup form")).toBeInTheDocument();
  });
});
