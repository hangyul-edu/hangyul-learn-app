import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { summary } = vi.hoisted(() => ({ summary: vi.fn() }));
vi.mock("../api/endpoints", () => ({ dashboardApi: { summary } }));

import { Personalized } from "./Personalized";
import { I18nProvider } from "../i18n";

function Loc() {
  const l = useLocation();
  return <div data-testid="loc">{l.pathname}{l.search}{JSON.stringify((l.state as unknown) ?? null)}</div>;
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

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/recommend"]}>
          <Routes>
            <Route path="/recommend" element={<><Personalized /><Loc /></>} />
            <Route path="/session/topik" element={<><div>TOPIK SESSION</div><Loc /></>} />
            <Route path="/session/conversation" element={<><div>CONVERSATION SESSION</div><Loc /></>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,);
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

describe("Personalized — TOPIK part-selection gating", () => {
  it("conversation start navigates directly, with no part modal", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "바로 시작하기" }));
    await waitFor(() => expect(screen.getByText("CONVERSATION SESSION")).toBeInTheDocument());
    expect(screen.queryByText("학습할 파트를 선택하세요")).not.toBeInTheDocument();
  });

  it("TOPIK start opens the part modal instead of navigating", async () => {
    renderPage();
    await screen.findByRole("button", { name: "바로 시작하기" });
    await userEvent.click(screen.getByRole("tab", { name: "TOPIK" })); // switch to TOPIK tab
    await userEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
    expect(await screen.findByText("학습할 파트를 선택하세요")).toBeInTheDocument();
    // Did NOT navigate.
    expect(screen.getByTestId("loc")).toHaveTextContent("/recommend");
    expect(screen.queryByText("TOPIK SESSION")).not.toBeInTheDocument();
  });

  it("navigates to the TOPIK session with the chosen section after 시작할게요", async () => {
    renderPage();
    await screen.findByRole("button", { name: "바로 시작하기" });
    await userEvent.click(screen.getByRole("tab", { name: "TOPIK" }));
    await userEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
    await screen.findByText("학습할 파트를 선택하세요");
    await userEvent.click(screen.getByRole("radio", { name: "읽기" }));
    await userEvent.click(screen.getByRole("button", { name: /시작할게요/ }));
    await waitFor(() => expect(screen.getByText("TOPIK SESSION")).toBeInTheDocument());
    expect(screen.getByTestId("loc")).toHaveTextContent('"section":"reading"');
  });

  it("closing the modal starts no session and stays on the page", async () => {
    renderPage();
    await screen.findByRole("button", { name: "바로 시작하기" });
    await userEvent.click(screen.getByRole("tab", { name: "TOPIK" }));
    await userEvent.click(screen.getByRole("button", { name: "바로 시작하기" }));
    await screen.findByText("학습할 파트를 선택하세요");
    await userEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByText("학습할 파트를 선택하세요")).not.toBeInTheDocument();
    expect(screen.getByTestId("loc")).toHaveTextContent("/recommend");
    expect(screen.queryByText("TOPIK SESSION")).not.toBeInTheDocument();
  });
});
