/**
 * After any login (email, or a social login via /auth/complete) the client
 * routes by the server's next_step. A first social login goes to the terms
 * step; an existing account goes straight on, never through it.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Me, NextStep, TokenResponse } from "../lib/types";

const { bootstrapMe } = vi.hoisted(() => ({ bootstrapMe: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ applyTokens: vi.fn(), bootstrapMe }) }));

import { useLoginFlow } from "./loginFlow";

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
  it("sends a first social login to the terms step", async () => {
    expect(await routeFor(token("terms_agreement", true), { nickname: null, terms_agreement_pending: true }))
      .toBe("/signup/terms");
  });

  it("resumes at the terms step when the user left before agreeing", async () => {
    expect(await routeFor(token("terms_agreement"), { nickname: null, terms_agreement_pending: true }))
      .toBe("/signup/terms");
  });

  it("takes an agreed account on to profile registration and onboarding", async () => {
    expect(await routeFor(token("profile_registration"), { nickname: null, terms_agreement_pending: false }))
      .toBe("/setup/profile");
  });

  it("logs an existing account straight in", async () => {
    expect(await routeFor(token("home"), { nickname: "me", terms_agreement_pending: false })).toBe("/home");
  });
});
