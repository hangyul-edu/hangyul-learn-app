/**
 * Sign-up must never show `00:00` next to a code it has already accepted.
 *
 * This drives the real screen rather than the hook, because the bug lived in
 * the markup: the timer element rendered unconditionally and fed `0` into the
 * formatter once `verified` flipped, so a confirmed code was labelled with the
 * one value that means "too late".
 *
 * Sign-up is covered here because it is the only screen carrying two
 * independent verifications at once — a phone one that is done and an email one
 * still running — which is where a shared timer would leak between them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import { I18nProvider } from "../i18n";

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

function inSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function started(expiresInSeconds: number) {
  return {
    verification_id: "evr_1",
    expires_at: inSeconds(expiresInSeconds),
    resend_available_at: inSeconds(0),
  };
}

function renderSignup() {
  return render(
    <I18nProvider language="en">
      <ToastProvider>
        <MemoryRouter>
          <Signup />
        </MemoryRouter>
      </ToastProvider>
    </I18nProvider>,
  );
}

/** Every MM:SS label currently on screen. */
function timerLabels(): string[] {
  return Array.from(document.querySelectorAll(".signup__timer")).map(
    (el) => el.textContent?.trim() ?? "",
  );
}

async function verifyPhone(user: ReturnType<typeof userEvent.setup>, expiresIn = 180) {
  api.startPhone.mockResolvedValue(started(expiresIn));
  api.confirmPhone.mockResolvedValue({ verification_token: "phone-tok" });

  await user.type(screen.getByLabelText("Phone number"), "1012345678");
  await user.click(screen.getByRole("button", { name: "Request phone verification code" }));
  await screen.findByLabelText("Phone verification code");
  await user.type(screen.getByLabelText("Phone verification code"), "123456");
  await user.click(screen.getByRole("button", { name: "Check phone verification code" }));
}

describe("the sign-up verification countdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts down while the phone code is pending", async () => {
    const user = userEvent.setup();
    api.startPhone.mockResolvedValue(started(180));
    renderSignup();

    await user.type(screen.getByLabelText("Phone number"), "1012345678");
    await user.click(screen.getByRole("button", { name: "Request phone verification code" }));

    // Wall-clock time passes while typing, so pin the shape, not the second.
    await waitFor(() => expect(timerLabels()).toHaveLength(1));
    expect(timerLabels()[0]).toMatch(/^0[23]:\d\d$/);
  });

  it("removes the timer once the phone code is confirmed", async () => {
    const user = userEvent.setup();
    renderSignup();

    await verifyPhone(user);

    await waitFor(() => expect(timerLabels()).toEqual([]));
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("shows no 00:00 when the code is confirmed on the last second", async () => {
    // The boundary case: the countdown reaches zero in the same beat as success.
    const user = userEvent.setup();
    renderSignup();

    await verifyPhone(user, 1);

    await waitFor(() => expect(timerLabels()).toEqual([]));
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("keeps the email countdown running while the phone one is already done", async () => {
    const user = userEvent.setup();
    api.startEmail.mockResolvedValue(started(180));
    renderSignup();

    await verifyPhone(user);
    await waitFor(() => expect(timerLabels()).toEqual([]));

    await user.type(screen.getByLabelText("Email", { selector: "#su-email" }), "learner@talkhangyul.co.kr");
    await user.click(screen.getByRole("button", { name: "Request email verification code" }));

    // Exactly one timer: the email one. The confirmed phone contributes none.
    await waitFor(() => expect(timerLabels()).toHaveLength(1));
    expect(timerLabels()[0]).toMatch(/^0[23]:\d\d$/);
  });

  it("still shows the timer after a failed confirmation", async () => {
    const user = userEvent.setup();
    api.startPhone.mockResolvedValue(started(180));
    api.confirmPhone.mockImplementation(() => Promise.reject(new Error("bad code")));
    renderSignup();

    await user.type(screen.getByLabelText("Phone number"), "1012345678");
    await user.click(screen.getByRole("button", { name: "Request phone verification code" }));
    await screen.findByLabelText("Phone verification code");
    await user.type(screen.getByLabelText("Phone verification code"), "123456");
    await user.click(screen.getByRole("button", { name: "Check phone verification code" }));

    await waitFor(() => expect(timerLabels()).toHaveLength(1));
  });
});

describe("editing a verified identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression: a code/token stayed bound to the value it was sent to while the
  // field changed underneath it, so signup sent a new number/address with the
  // old one's proof — rejected by the server with the field already locked.
  it("changing the phone number drops the pending phone code", async () => {
    const user = userEvent.setup();
    api.startPhone.mockResolvedValue(started(180));
    renderSignup();

    await user.type(screen.getByLabelText("Phone number"), "1012345678");
    await user.click(screen.getByRole("button", { name: "Request phone verification code" }));
    await screen.findByLabelText("Phone verification code");

    await user.type(screen.getByLabelText("Phone number"), "9");
    expect(screen.queryByLabelText("Phone verification code")).toBeNull();
  });

  it("changing the email drops the pending email code", async () => {
    const user = userEvent.setup();
    api.startEmail.mockResolvedValue(started(180));
    renderSignup();

    const email = screen.getByLabelText("Email", { selector: "#su-email" });
    await user.type(email, "learner@talkhangyul.co.kr");
    await user.click(screen.getByRole("button", { name: "Request email verification code" }));
    await screen.findByLabelText("Email verification code");

    await user.type(email, "x");
    expect(screen.queryByLabelText("Email verification code")).toBeNull();
  });
});
