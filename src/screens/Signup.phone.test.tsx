/**
 * The sign-up phone field: country rules decide what is sent, a pasted
 * international number moves the picker, and a refused number explains why
 * without sending an SMS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";

vi.mock("../hooks/loginFlow", () => ({ useLoginFlow: () => vi.fn() }));
vi.mock("../api/endpoints", () => ({
  authApi: {
    startPhone: vi.fn(),
    confirmPhone: vi.fn(),
    startEmail: vi.fn(),
    confirmEmail: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
  },
}));

import { authApi } from "../api/endpoints";
import { Signup } from "./Signup";

const api = authApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderSignup(language: AppLanguage = "en") {
  return render(
    <I18nProvider language={language}>
      <ToastProvider>
        <MemoryRouter>
          <Signup />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
}

const phoneField = () => screen.getByLabelText("Phone number");
const requestCode = () => screen.getByRole("button", { name: "Request phone verification code" });

beforeEach(() => {
  vi.clearAllMocks();
  const later = new Date(Date.now() + 180_000).toISOString();
  api.startPhone.mockResolvedValue({ verification_id: "v1", expires_at: later, resend_available_at: later });
});

describe("sign-up phone field", () => {
  it.each([
    ["01012345678", "+821012345678"],
    ["1012345678", "+821012345678"],
    ["010-1234-5678", "+821012345678"],
  ])("sends %s as %s", async (typed, e164) => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(phoneField(), typed);
    await user.click(requestCode());
    expect(api.startPhone).toHaveBeenCalledWith(e164, "signup");
  });

  it("follows a pasted international number to its country", async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(phoneField());
    await user.paste("+44 7400 123456");
    expect(phoneField()).toHaveValue("07400123456");
    expect(screen.getByRole("button", { name: "Select country, currently United Kingdom" })).toBeInTheDocument();
    await user.click(requestCode());
    expect(api.startPhone).toHaveBeenCalledWith("+447400123456", "signup");
  });

  it("uses the selected country's rules", async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.click(screen.getByRole("button", { name: /Select country/ }));
    await user.type(screen.getByRole("searchbox"), "italy");
    await user.click(screen.getByRole("button", { name: /^Italy/ }));
    await user.type(phoneField(), "312 345 6789");
    await user.click(requestCode());
    expect(api.startPhone).toHaveBeenCalledWith("+393123456789", "signup");
  });

  it.each([
    ["010123", "This number is too short for South Korea (+82)."],
    ["0101234567890123", "This number is too long for South Korea (+82)."],
    ["0212345678", "This isn't a valid South Korea (+82) mobile number. Check the country and the number."], // landline
    ["0901234567", "This isn't a valid South Korea (+82) mobile number. Check the country and the number."],
  ])("refuses %s without sending an SMS", async (typed, message) => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(phoneField(), typed);
    await user.click(requestCode());
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(api.startPhone).not.toHaveBeenCalled();
  });

  it("asks for a number when the field is empty", async () => {
    const user = userEvent.setup();
    renderSignup("ko");
    await user.click(screen.getByRole("button", { name: "휴대폰 인증번호 요청" }));
    expect(await screen.findByText("휴대폰 번호를 입력해 주세요.")).toBeInTheDocument();
  });

  it("clears the error once the number is edited", async () => {
    const user = userEvent.setup();
    renderSignup();
    await user.type(phoneField(), "010123");
    await user.click(requestCode());
    await screen.findByText(/too short/);
    await user.type(phoneField(), "4");
    expect(screen.queryByText(/too short/)).not.toBeInTheDocument();
  });
});
