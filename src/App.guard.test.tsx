import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { Me } from "./lib/types";
import { I18nProvider } from "./i18n";

const auth = vi.hoisted(() => ({ status: "signed-in", me: null as Partial<Me> | null }));
vi.mock("./hooks/auth", () => ({ useAuth: () => auth }));

import { RequireAuth } from "./App";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

/** Open `path` behind the guard and report where the member ends up. */
function landOn(path: string, me: Partial<Me>): string {
  auth.me = { nickname: null, onboarding_completed: false, ...me };
  const page = <RequireAuth><Where /></RequireAuth>;
  const { unmount } = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {["/home", "/setup/phone", "/signup/terms", "/setup/profile"].map((p) => (
          <Route key={p} path={p} element={page} />
        ))}
      </Routes>
    </MemoryRouter>,
  );
  const where = screen.getByTestId("where").textContent ?? "";
  unmount();
  return where;
}

describe("RequireAuth — social signup order", () => {
  const newMember = { terms_agreement_pending: true, phone_verification_pending: true };

  it.each(["/home", "/signup/terms", "/setup/profile", "/setup/phone"])(
    "keeps a new social member without a phone on the phone step (from %s)",
    (path) => {
      // Regression: the phone page used to send them to the terms, which sent
      // them back — an endless redirect.
      expect(landOn(path, newMember)).toBe("/setup/phone");
    },
  );

  it("moves on to the terms once the phone is verified", () => {
    expect(landOn("/setup/phone", { terms_agreement_pending: true, phone_verification_pending: false }))
      .toBe("/signup/terms");
    expect(landOn("/home", { terms_agreement_pending: true, phone_verification_pending: false }))
      .toBe("/signup/terms");
  });

  it("sends an existing account that agreed long ago but has no phone straight to the phone step", () => {
    expect(landOn("/home", { terms_agreement_pending: false, phone_verification_pending: true, nickname: "me" }))
      .toBe("/setup/phone");
  });
});

describe("RequireAuth — launch check without an answer", () => {
  it("shows the connection error with a retry instead of the page or the splash", () => {
    const retryStartup = vi.fn();
    Object.assign(auth, { status: "unreachable", me: null, retryStartup });
    try {
      render(
        <I18nProvider language="ko">
          <MemoryRouter initialEntries={["/home"]}>
            <Routes>
              <Route path="/home" element={<RequireAuth><Where /></RequireAuth>} />
            </Routes>
          </MemoryRouter>
        </I18nProvider>,
      );
      expect(screen.getByRole("alert")).toHaveTextContent("연결이 원활하지 않아요");
      expect(screen.queryByTestId("where")).not.toBeInTheDocument();
      screen.getByRole("button", { name: "다시 시도" }).click();
      expect(retryStartup).toHaveBeenCalledTimes(1);
    } finally {
      auth.status = "signed-in";
    }
  });
});
