import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";

vi.mock("../api/endpoints", () => ({
  authApi: {
    socialExchange: vi.fn(),
    socialStartUrl: (provider: string, challenge: string, returnTo = "/") =>
      `/api/auth/social/${provider}/start?return_to=${encodeURIComponent(returnTo)}&client_challenge=${challenge}`,
  },
}));
const completeLogin = vi.fn();
vi.mock("../hooks/loginFlow", () => ({ useLoginFlow: () => completeLogin }));

import { authApi } from "../api/endpoints";
import { AuthComplete } from "./AuthComplete";
import {
  clientChallenge,
  newClientVerifier,
  takeClientVerifier,
  takePendingReauth,
  useSocialLogin,
} from "../hooks/socialLogin";
import { loadPendingSignup } from "../hooks/socialSignup";

const exchange = authApi.socialExchange as unknown as ReturnType<typeof vi.fn>;

function renderAt(url: string) {
  return render(
    <I18nProvider language="en">
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/complete" element={<AuthComplete />} />
          <Route path="/signup/phone" element={<p>phone step</p>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("social login browser binding", () => {
  it("generates a 43-char URL-safe verifier and its S256 challenge", async () => {
    const verifier = newClientVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newClientVerifier()).not.toBe(verifier);
    // Must equal the backend's code_challenge_s256 for the same input
    // (src/common/security/oauth_pkce.py), or no login code could be redeemed.
    expect(await clientChallenge("dBjftJeZ4CVP-mJ92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "ngF5GsXcbwljx6u133FFr3Xht9xooA_DuaX_3QwODtc",
    );
  });

  it("start() stores the verifier and sends only the challenge", async () => {
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      let start: ((p: "google") => Promise<void>) | undefined;
      function Probe() {
        start = useSocialLogin().start;
        return null;
      }
      render(<Probe />);
      await start!("google");
      const stored = window.localStorage.getItem("hg-social-verifier");
      expect(stored).toBeTruthy();
      const url = assign.mock.calls[0][0] as string;
      expect(url).toContain(`client_challenge=${await clientChallenge(stored!)}`);
      expect(url).not.toContain(stored!);
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("redeems the login code with the stored verifier, once", async () => {
    window.localStorage.setItem("hg-social-verifier", "my-verifier");
    exchange.mockResolvedValue({ access_token: "a" });
    renderAt("/auth/complete?login_code=code-1");
    await waitFor(() => expect(exchange).toHaveBeenCalledWith("code-1", "my-verifier"));
    await waitFor(() => expect(completeLogin).toHaveBeenCalledWith({ access_token: "a" }, true));
    expect(takeClientVerifier()).toBeNull();
  });

  it("sends a first sign-in that matched no account to the phone step, with no session", async () => {
    window.localStorage.setItem("hg-social-verifier", "my-verifier");
    exchange.mockResolvedValue({
      signup_token: "ticket-1", provider: "line", expires_in: 1800, next_step: "phone_verification",
    });
    renderAt("/auth/complete?login_code=code-2");
    expect(await screen.findByText("phone step")).toBeInTheDocument();
    expect(completeLogin).not.toHaveBeenCalled();
    expect(loadPendingSignup()).toMatchObject({ signupToken: "ticket-1", provider: "line" });
  });

  it("never redeems a login code this browser did not start", async () => {
    renderAt("/auth/complete?login_code=someone-elses-code");
    expect(await screen.findByText("Your login session expired. Please try again.")).toBeInTheDocument();
    expect(exchange).not.toHaveBeenCalled();
  });

  it.each([
    ["provider_unavailable", "We can't reach the login service right now. Please try again in a moment."],
    ["email_registered", "An account with this email already exists. Please log in the way you originally signed up."],
    [
      "account_inactive",
      "This account has been deleted or suspended.",
    ],
    ["something_new", "Couldn't complete login. Please try again."],
  ])("shows a message for social_error=%s and drops the verifier", async (code, text) => {
    window.localStorage.setItem("hg-social-verifier", "v");
    renderAt(`/auth/complete?social_error=${code}`);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(window.localStorage.getItem("hg-social-verifier")).toBeNull();
  });
});

describe("re-authentication for account deletion", () => {
  function renderWithMore(url: string) {
    return render(
      <I18nProvider language="en">
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/auth/complete" element={<AuthComplete />} />
            <Route path="/profile" element={<p>more screen</p>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );
  }

  beforeEach(() => window.sessionStorage.clear());

  it("hands the reauth code and this browser's verifier to the More screen, issuing no session", async () => {
    window.localStorage.setItem("hg-social-verifier", "my-verifier");
    window.localStorage.setItem("hg-social-purpose", "reauth");
    renderWithMore("/auth/complete?reauth_code=rc-1&provider=apple&return_to=%2Fprofile");
    expect(await screen.findByText("more screen")).toBeInTheDocument();
    expect(takePendingReauth()).toEqual({ provider: "apple", reauth_code: "rc-1", client_verifier: "my-verifier" });
    expect(exchange).not.toHaveBeenCalled();
    expect(completeLogin).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("hg-social-purpose")).toBeNull();
  });

  it("returns a failed re-authentication to the More screen as an error", async () => {
    window.localStorage.setItem("hg-social-verifier", "v");
    window.localStorage.setItem("hg-social-purpose", "reauth");
    renderWithMore("/auth/complete?social_error=cancelled&provider=apple");
    expect(await screen.findByText("more screen")).toBeInTheDocument();
    expect(takePendingReauth()).toEqual({ error: "cancelled" });
  });

  it("never forwards a reauth code this browser did not start", async () => {
    renderWithMore("/auth/complete?reauth_code=someone-elses&provider=apple");
    expect(await screen.findByText("more screen")).toBeInTheDocument();
    expect(takePendingReauth()).toEqual({ error: "login_failed" });
  });
});
