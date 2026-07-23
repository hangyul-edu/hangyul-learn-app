import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { summary, streak } = vi.hoisted(() => ({ summary: vi.fn(), streak: vi.fn() }));
vi.mock("../api/endpoints", () => ({ dashboardApi: { summary, streak } }));

import { LearningManagement } from "./LearningManagement";

function Loc() {
  return <div data-testid="loc">{useLocation().pathname}</div>;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/learning-management"]}>
        <Routes>
          <Route path="/learning-management" element={<><LearningManagement /><Loc /></>} />
          <Route path="/recommend" element={<><div>PERSONALIZED</div><Loc /></>} />
          <Route path="/home" element={<><div>HOME</div><Loc /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SUMMARY_ZERO = { today_minutes: 0, tracks: [] };
const SUMMARY_DATA = {
  today_minutes: 125, // 02:05
  tracks: [{ goal: { current: 3 } }, { goal: { current: 2 } }], // 5
};

beforeEach(() => {
  vi.clearAllMocks();
  summary.mockResolvedValue(SUMMARY_ZERO);
  streak.mockResolvedValue({ total_days: 0 });
});

describe("LearningManagement", () => {
  it("always renders the heading, summary labels, and section title", async () => {
    renderPage();
    expect(screen.getByText("첫 학습을 기다리고 있어요!")).toBeInTheDocument();
    expect(screen.getByText("오늘 공부한 시간")).toBeInTheDocument();
    expect(screen.getByText("오늘의 학습")).toBeInTheDocument();
    expect(screen.getByText("내 학습 기록")).toBeInTheDocument();
    await screen.findByText("학습 기록이 아직 없어요"); // settle
  });

  it("shows today's real study time (HH:MM) and summed learning count", async () => {
    summary.mockResolvedValue(SUMMARY_DATA);
    renderPage();
    expect(await screen.findByText("02:05")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders the empty state when there are no learning days", async () => {
    renderPage();
    expect(await screen.findByText("학습 기록이 아직 없어요")).toBeInTheDocument();
    expect(screen.getByText(/첫 학습을 시작하고/)).toBeInTheDocument();
    expect(screen.getByText(/당신의 기록을 만들어 보세요!/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /학습 시작하기/ })).toBeInTheDocument();
  });

  it("does not flash the empty state while the history request is loading", () => {
    streak.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
    // Summary card still renders (separate concern).
    expect(screen.getByText("오늘 공부한 시간")).toBeInTheDocument();
  });

  it("renders history (not the empty state) when the user has learning days", async () => {
    streak.mockResolvedValue({ total_days: 7 });
    renderPage();
    expect(await screen.findByText(/총 7일 학습했어요/)).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /학습 시작하기/ })).not.toBeInTheDocument();
  });

  it("shows an error (not the empty state) when the history request fails", async () => {
    streak.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("문제가 생겼어요")).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
  });

  it("navigates to the Personalized Learning page from the CTA", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /학습 시작하기/ }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/recommend"));
  });

  it("back button navigates to Home", async () => {
    renderPage();
    await screen.findByText("학습 기록이 아직 없어요");
    await userEvent.click(screen.getByRole("button", { name: "뒤로" }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/home"));
  });
});
