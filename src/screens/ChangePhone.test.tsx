/**
 * Changing the phone number: any country, the account's nationality as the
 * starting country, and a reason when the number is refused (the request
 * button used to just stay disabled, and non-Korean numbers were only
 * length-checked).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { me } = vi.hoisted(() => ({ me: { current: null as null | { phone: string; nationality: string | null } } }));
vi.mock("../api/endpoints", () => ({ authApi: { startPhone: vi.fn(), confirmPhone: vi.fn(), changePhone: vi.fn() } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: me.current, setMe: vi.fn() }) }));
const toastError = vi.fn();
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: toastError, success: vi.fn(), show: vi.fn() }) }));

import { authApi } from "../api/endpoints";
import { ChangePhone } from "./AccountChanges";
import { I18nProvider } from "../i18n";

const api = authApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderScreen() {
  return render(
    <I18nProvider language="en">
      <MemoryRouter>
        <ChangePhone />
      </MemoryRouter>
    </I18nProvider>,
  );
}

const phoneField = () => document.querySelector<HTMLInputElement>(".pchg__phone")!;
const requestCode = () => screen.getByRole("button", { name: /verification code/i });

beforeEach(() => {
  vi.clearAllMocks();
  me.current = { phone: "+821099998888", nationality: "KR" };
  const later = new Date(Date.now() + 180_000).toISOString();
  api.startPhone.mockResolvedValue({ verification_id: "v1", expires_at: later, resend_available_at: later });
});

describe("ChangePhone", () => {
  it("starts on the account's nationality and applies that country's rules", async () => {
    me.current = { phone: "+819012345678", nationality: "JP" };
    const user = userEvent.setup();
    renderScreen();
    expect(screen.getByRole("button", { name: "Select country, currently Japan" })).toBeInTheDocument();
    await user.type(phoneField(), "080-1234-5678");
    await user.click(requestCode());
    expect(api.startPhone).toHaveBeenCalledWith("+818012345678", "change_phone");
  });

  it("falls back to Korea for an unknown nationality", () => {
    me.current = { phone: "+821099998888", nationality: "ZZ" };
    renderScreen();
    expect(screen.getByRole("button", { name: "Select country, currently South Korea" })).toBeInTheDocument();
  });

  it("explains a refused number instead of sending", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(phoneField(), "0212345678");
    await user.click(requestCode());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This isn't a valid South Korea (+82) mobile number.",
    );
    expect(phoneField()).toHaveAttribute("aria-invalid", "true");
    expect(api.startPhone).not.toHaveBeenCalled();
  });

  it("recognises the current number however it is typed", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.type(phoneField(), "010-9999-8888");
    await user.click(requestCode());
    expect(toastError).toHaveBeenCalledWith("That's already your current number");
    expect(api.startPhone).not.toHaveBeenCalled();
  });
});
