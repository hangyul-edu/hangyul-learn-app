/**
 * After any login (email, or a social login via /auth/complete) the client
 * routes by the server's next_step. A first social login goes to the terms
 * step, then — without a phone number — the phone step; an existing account
 * goes straight on, never through them.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Me, NextStep, TokenResponse } from "../lib/types";

const { bootstrapMe } = vi.hoisted(() => ({ bootstrapMe: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ applyTokens: vi.fn(), bootstrapMe }) }));

import { nextSetupPath, pathForStep, useLoginFlow } from "./loginFlow";

function token(next_step: NextStep, is_new_user = false): TokenResponse {
  return {
    access_token: "a", refresh_token: "r", token_type: "bearer", expires_in: 900, user_id: "u",
    is_new_user, membership: { tier: "free", is_premium: false, expires_at: null }, next_step,
  };
}

function Runner({ tok }: { tok: TokenResponse }) {
  const complete = useLoginFlow();
  return <button onClick={() => void complete(tok, true)}>go</button>;
}

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

async function routeFor(tok: TokenResponse, me: Partial<Me>): Promise<string> {
  bootstrapMe.mockResolvedValue(me);
  render(
    <MemoryRouter initialEntries={["/auth/complete"]}>
      <Routes>
        <Route path="/auth/complete" element={<Runner tok={tok} />} />
        <Route path="*" element={<Loc />} />
      </Routes>
    </MemoryRouter>,
  );
  screen.getByRole("button").click();
  await waitFor(() => expect(screen.getByTestId("loc")).toBeInTheDocument());
  return screen.getByTestId("loc").textContent ?? "";
}

describe("useLoginFlow", () => {
  it("sends a new social member to the phone step before the terms", async () => {
    expect(
      await routeFor(token("phone_verification", true), {
        nickname: null, terms_agreement_pending: true, phone_verification_pending: true,
      }),
    ).toBe("/setup/phone");
  });

  it("sends a first social login whose provider gave a phone to the terms step", async () => {
    expect(await routeFor(token("terms_agreement", true), { nickname: null, terms_agreement_pending: true }))
      .toBe("/signup/terms");
  });

  it("resumes at the terms step when the user left before agreeing", async () => {
    expect(await routeFor(token("terms_agreement"), { nickname: null, terms_agreement_pending: true }))
      .toBe("/signup/terms");
  });

  it("sends a social account without a phone to the phone step", async () => {
    expect(
      await routeFor(token("phone_verification"), {
        nickname: null, terms_agreement_pending: false, phone_verification_pending: true,
      }),
    ).toBe("/setup/phone");
  });

  it("keeps the phone step ahead of the profile whatever next_step says", async () => {
    expect(
      await routeFor(token("profile_registration"), {
        nickname: null, terms_agreement_pending: false, phone_verification_pending: true,
      }),
    ).toBe("/setup/phone");
  });

  it("takes an agreed account on to profile registration and onboarding", async () => {
    expect(await routeFor(token("profile_registration"), { nickname: null, terms_agreement_pending: false }))
      .toBe("/setup/profile");
  });

  it("logs an existing account straight in", async () => {
    expect(await routeFor(token("home"), { nickname: "me", terms_agreement_pending: false })).toBe("/home");
  });
});

describe("signup step paths", () => {
  it("maps every next_step to its screen", () => {
    expect(pathForStep("terms_agreement")).toBe("/signup/terms");
    expect(pathForStep("phone_verification")).toBe("/setup/phone");
    expect(pathForStep("profile_registration")).toBe("/setup/profile");
    expect(pathForStep("onboarding")).toBe("/setup/onboarding");
    expect(pathForStep("home")).toBe("/home");
  });

  it("continues setup from the profile in journey order", () => {
    const me = (over: Partial<Me>) =>
      ({ nickname: null, terms_agreement_pending: false, phone_verification_pending: false,
        onboarding_completed: false, ...over }) as Me;
    // The phone comes before the terms of a new social member.
    expect(nextSetupPath(me({ terms_agreement_pending: true, phone_verification_pending: true }))).toBe("/setup/phone");
    expect(nextSetupPath(me({ terms_agreement_pending: true }))).toBe("/signup/terms");
    expect(nextSetupPath(me({ phone_verification_pending: true }))).toBe("/setup/phone");
    expect(nextSetupPath(me({}))).toBe("/setup/profile");
    expect(nextSetupPath(me({ nickname: "me" }))).toBe("/setup/onboarding");
    expect(nextSetupPath(me({ nickname: "me", onboarding_completed: true }))).toBe("/home");
  });
});
