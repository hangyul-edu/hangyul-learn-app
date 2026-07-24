import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { summary } = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("../api/endpoints", () => ({ dashboardApi: { summary } }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));
vi.mock("../lib/http", () => ({ http: { get: vi.fn().mockResolvedValue({ has_unread: false }) } }));

import { Home } from "./Home";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{JSON.stringify((l.state as unknown) ?? null)}</div>;
}

const track = (category: "conversation" | "topik", name: string) => ({
  track_id: `t_${category}`,
  category,
  display_order: 1,
  name,
  level: 1,
  level_label: "Lv.1",
  next_lesson_id: null,
  goal: { key: "daily", label: "하루 목표", target: 5, current: 0, achieved: false },
});

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<><Home /><Loc /></>} />
          <Route path="/session/topik" element={<><div>TOPIK SESSION</div><Loc /></>} />
          <Route path="/session/conversation" element={<div>CONVERSATION SESSION</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summary.mockResolvedValue({
    user_id: "u1",
    streak_days: 2,
    last_study_date: null,
    today_minutes: 0,
    studied_today: false,
    paywall_required: false,
    tracks: [track("conversation", "회화"), track("topik", "TOPIK")],
  });
});

describe("Home — TOPIK part-selection gating", () => {
  it("conversation start navigates directly, with no part modal", async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "바로 시작하기" }));
    await waitFor(() => expect(screen.getByText("CONVERSATION SESSION")).toBeInTheDocument());
    expect(screen.queryByText("학습할 파트를 선택하세요")).not.toBeInTheDocument();
  });

  it("TOPIK start opens the part modal, then navigates with the chosen section", async () => {
    renderHome();
    await screen.findByRole("button", { name: "바로 시작하기" });
    await userEvent.click(screen.getByRole("tab", { name: "TOPIK" }));
    await userEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
    expect(await screen.findByText("학습할 파트를 선택하세요")).toBeInTheDocument();
    expect(screen.getByTestId("loc")).toHaveTextContent("/home"); // no nav yet

    await userEvent.click(screen.getByRole("radio", { name: "쓰기" }));
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    await waitFor(() => expect(screen.getByText("TOPIK SESSION")).toBeInTheDocument());
    expect(screen.getByTestId("loc")).toHaveTextContent('"section":"writing"');
  });
});
