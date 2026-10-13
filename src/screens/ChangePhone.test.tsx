/**
 * Changing the phone number: any country, the account's nationality as the
 * starting country, and a reason when the number is refused (the request
 * button used to just stay disabled, and non-Korean numbers were only
 * length-checked).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { me } = vi.hoisted(() => ({ me: { current: null as null | { phone: string; nationality: string | null } } }));
vi.mock("../api/endpoints", () => ({ authApi: { startPhone: vi.fn(), confirmPhone: vi.fn(), changePhone: vi.fn() } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: me.current, setMe: vi.fn() }) }));
const { toastError, toastSuccess } = vi.hoisted(() => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: toastError, success: toastSuccess, show: vi.fn() }) }));

import { authApi } from "../api/endpoints";
import { ChangePhone } from "./AccountChanges";
import { I18nProvider } from "../i18n";

const api = authApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderScreen(qc = new QueryClient()) {
  return render(
    <I18nProvider language="en">
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ChangePhone />
        </MemoryRouter>
      </QueryClientProvider>
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
    expect(await screen.findByRole("alert")).toHaveTextContent("That's already your current number");
    expect(toastError).not.toHaveBeenCalled();
    expect(api.startPhone).not.toHaveBeenCalled();
  });

  it("reports sending and checking the code on screen, never by toast", async () => {
    api.confirmPhone
      .mockRejectedValueOnce(new Error("The verification code is incorrect."))
      .mockResolvedValueOnce({ verification_token: "tok" });
    const user = userEvent.setup();
    renderScreen();
    await user.type(phoneField(), "010-1234-5678");
    await user.click(requestCode());
    const codeField = await waitFor(() => document.querySelector<HTMLInputElement>(".pchg__code")!);
    await user.type(codeField, "111111");
    await user.click(document.querySelector<HTMLButtonElement>(".pchg__confirm")!);
    expect(await screen.findByText("The verification code is incorrect.")).toHaveClass("pchg__msg", "is-err");
    // Typing again clears the refusal.
    await user.type(codeField, "1");
    expect(screen.queryByText("The verification code is incorrect.")).not.toBeInTheDocument();
    await user.type(codeField, "23456");
    await user.click(document.querySelector<HTMLButtonElement>(".pchg__confirm")!);
    await waitFor(() => expect(document.querySelector(".pchg__msg")).toHaveClass("is-ok"));
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("shows a refused send under the number", async () => {
    api.startPhone.mockRejectedValueOnce(new Error("Too many requests. Try again later."));
    const user = userEvent.setup();
    renderScreen();
    await user.type(phoneField(), "010-1234-5678");
    await user.click(requestCode());
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests. Try again later.");
    expect(toastError).not.toHaveBeenCalled();
  });

  it("drops the billing data read for the old number once the change is saved", async () => {
    // The calling code decides the currency (+82 → KRW, else USD) and which
    // card may be registered, so nothing cached for the old number may stay.
    api.confirmPhone.mockResolvedValue({ verification_token: "tok" });
    api.changePhone.mockResolvedValue({ phone: "+14155550123" });
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const user = userEvent.setup();
    me.current = { phone: "+821099998888", nationality: "US" };
    renderScreen(qc);
    await user.type(phoneField(), "415-555-0123");
    await user.click(requestCode());
    await user.type(document.querySelector<HTMLInputElement>(".pchg__code")!, "123456");
    await user.click(document.querySelector<HTMLButtonElement>(".pchg__confirm")!);
    await waitFor(() => expect(document.querySelector(".pchg__submit")).toBeEnabled());
    expect(invalidate).not.toHaveBeenCalled();
    await user.click(document.querySelector<HTMLButtonElement>(".pchg__submit")!);
    await waitFor(() => expect(api.changePhone).toHaveBeenCalled());
    const keys = invalidate.mock.calls.map(([f]) => JSON.stringify(f?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining(['["payment-methods"]', '["sub-offers"]', '["intl-card-options"]']),
    );
  });
});
