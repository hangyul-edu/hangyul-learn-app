import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../api/endpoints", () => ({ authApi: { changePassword: vi.fn() } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ hardSignOut: vi.fn(), me: null, setMe: vi.fn() }) }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { ChangePassword } from "./AccountChanges";
import { I18nProvider } from "../i18n";

function renderScreen() {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>
    </I18nProvider>,
  );
}

function fill(current: string, next: string) {
  fireEvent.change(document.getElementById("pwch-cur")!, { target: { value: current } });
  fireEvent.change(document.getElementById("pwch-new")!, { target: { value: next } });
  fireEvent.change(document.getElementById("pwch-confirm")!, { target: { value: next } });
}

const submit = () => document.querySelector<HTMLButtonElement>(".pwch__submit")!;

beforeEach(() => vi.clearAllMocks());

describe("ChangePassword — password policy", () => {
  it("accepts a password that meets the policy", () => {
    renderScreen();
    fill("OldPass1!", "NewPass1!");
    expect(submit()).toBeEnabled();
  });

  it("rejects a password longer than the 64-character maximum", () => {
    // Regression: the screen checked only the lower bound, so an over-long
    // password enabled 변경하기 and came back as a raw 422 from the server.
    renderScreen();
    fill("OldPass1!", `Aa1!${"a".repeat(61)}`); // 65 characters
    expect(submit()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/8자리 이상/);
  });
});
