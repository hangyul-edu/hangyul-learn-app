import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

vi.mock("./hooks/auth", () => ({ useAuth: () => ({ status: "signed-in", me: null }) }));

import { RETIRED_SCREENS } from "./App";

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

/** Open `path` with the retired-screen redirects mounted, and report where it lands. */
function landOn(path: string): string {
  const { unmount } = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        {RETIRED_SCREENS.map(([from, to]) => (
          <Route key={from} path={from} element={<Navigate to={to} replace />} />
        ))}
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  const where = screen.getByTestId("where").textContent ?? "";
  unmount();
  return where;
}

describe("retired Learn screens", () => {
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
  ])("%s opens %s", (from, to) => {
    expect(landOn(from)).toBe(to);
  });

  it("leaves current screens alone", () => {
    expect(landOn("/recommend")).toBe("/recommend");
    expect(landOn("/recommend/settings")).toBe("/recommend/settings");
  });
});
