import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("./hooks/auth", () => ({ useAuth: () => ({ status: "signed-in", me: null }) }));

import { RETIRED_SCREENS, RetiredRedirect } from "./App";

function Where() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="where">{pathname + search + hash}</div>;
}

/** Open `path` with the retired-screen redirects mounted, and report where it lands. */
function landOn(path: string): string {
  const { unmount } = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {RETIRED_SCREENS.map(([from, to]) => (
          <Route key={from} path={from} element={<RetiredRedirect to={to} />} />
        ))}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = screen.getByTestId("where").textContent ?? "";
  unmount();
  return where;
}

describe("retired screens", () => {
  it.each([
    // What study-goal notifications linked to before, and are still stored.
    ["/learn/conversation", "/recommend?track=conversation"],
    ["/learn/topik", "/recommend?track=topik"],
    ["/learn", "/recommend"],
    ["/quiz/quz_123", "/recommend?track=topik"],
    ["/exams", "/recommend?track=topik"],
    ["/exams/exs_2024_1", "/recommend?track=topik"],
    ["/recommend/sentences", "/recommend?track=conversation"],
    ["/ai", "/courses"],
    ["/account/billing", "/subscription"],
    // What league notifications linked to before.
    ["/leagues/2026-W16/grp_abc", "/league"],
    ["/leagues", "/league"],
  ])("%s opens %s", (from, to) => {
    expect(landOn(from)).toBe(to);
  });

  it("keeps the old link's parameters and fragment", () => {
    expect(landOn("/account/billing?utm_source=email#top")).toBe("/subscription?utm_source=email#top");
    expect(landOn("/learn?utm_source=push")).toBe("/recommend?utm_source=push");
  });

  it("lets the successor's own parameters win", () => {
    expect(landOn("/learn/topik?track=conversation&ref=mail")).toBe("/recommend?track=topik&ref=mail");
  });

  it("leaves current screens alone", () => {
    expect(landOn("/recommend")).toBe("/recommend");
    expect(landOn("/recommend/settings")).toBe("/recommend/settings");
    expect(landOn("/subscription")).toBe("/subscription");
    expect(landOn("/account/payment")).toBe("/account/payment");
    expect(landOn("/league")).toBe("/league");
    expect(landOn("/league/history")).toBe("/league/history");
    expect(landOn("/league/result")).toBe("/league/result");
  });
});
