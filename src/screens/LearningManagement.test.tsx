import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import type { ManagementPeriod, ManagementStats } from "../lib/types";

/* -------------------------------- mocks --------------------------------- */
const { management } = vi.hoisted(() => ({ management: vi.fn() }));
vi.mock("../api/endpoints", () => ({ learnApi: { management } }));

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

function stats(period: ManagementPeriod, over: Partial<ManagementStats> = {}): ManagementStats {
  return {
    period,
    timezone: "UTC",
    range: { start_date: "2026-07-20", end_date: "2026-07-26" },
    has_any_eligible_learning_record: true,
    today: { study_seconds: 3600, conversation_sentence_count: 3, topik_question_count: 2, learning_count: 5 },
    buckets: [
      { key: "d1", start_date: "2026-07-20", end_date: "2026-07-20", label: "월", study_seconds: 1200, is_current: false },
      { key: "d2", start_date: "2026-07-23", end_date: "2026-07-23", label: "목", study_seconds: 3600, is_current: true },
    ],
    period_totals: { conversation_sentence_count: 5, topik_question_count: 5, learning_count: 10 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  management.mockResolvedValue(stats("7d"));
});

describe("LearningManagement", () => {
  it("renders the summary, chart, and period totals from server data", async () => {
    renderPage();
    expect(await screen.findByText("꾸준히 쌓이는 기록, 대단해요!")).toBeInTheDocument();
    const summary = document.querySelector(".lmgmt__summary") as HTMLElement;
    expect(within(summary).getByText("01:00")).toBeInTheDocument(); // 3600s → HH:MM
    expect(within(summary).getByText("5")).toBeInTheDocument(); // server learning_count
    // Chart bars + current-bucket value.
    expect(screen.getByText("월")).toBeInTheDocument();
    expect(screen.getByText("목")).toBeInTheDocument();
    expect(screen.getByText("1h0m")).toBeInTheDocument(); // current bucket duration
  });

  it("colors the current bucket orange and historical buckets gray", async () => {
    const { container } = renderPage();
    await screen.findByText("목");
    expect(container.querySelectorAll(".lmgmt__bar--current")).toHaveLength(1);
    expect(container.querySelectorAll(".lmgmt__bar")).toHaveLength(2);
  });

  it("shows a loading skeleton (not the empty state) before data arrives", () => {
    management.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector(".lmgmt__loading")).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
    expect(screen.queryByText(/기다리고 있어요/)).not.toBeInTheDocument();
  });

  it("shows the first-time empty state only when the server reports no lifetime record", async () => {
    management.mockResolvedValue(stats("7d", { has_any_eligible_learning_record: false }));
    renderPage();
    expect(await screen.findByText("첫 학습을 기다리고 있어요!")).toBeInTheDocument();
    expect(screen.getByText("학습 기록이 아직 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /학습 시작하기/ })).toBeInTheDocument();
    // Summary card still visible; chart/period totals replaced.
    expect(document.querySelector(".lmgmt__summary")).toBeInTheDocument();
    expect(document.querySelector(".lmgmt__chart")).not.toBeInTheDocument();
  });

  it("does NOT show the first-time CTA for a historical user with an empty period", async () => {
    management.mockResolvedValue(
      stats("7d", {
        has_any_eligible_learning_record: true,
        today: { study_seconds: 0, conversation_sentence_count: 0, topik_question_count: 0, learning_count: 0 },
        buckets: [{ key: "d", start_date: "2026-07-23", end_date: "2026-07-23", label: "목", study_seconds: 0, is_current: true }],
        period_totals: { conversation_sentence_count: 0, topik_question_count: 0, learning_count: 0 },
      }),
    );
    renderPage();
    await screen.findByText("목");
    expect(screen.queryByRole("button", { name: /학습 시작하기/ })).not.toBeInTheDocument();
    expect(document.querySelector(".lmgmt__chart")).toBeInTheDocument();
  });

  it("renders all four period options and requests the new period on selection", async () => {
    renderPage();
    await screen.findByText("목");
    await userEvent.click(screen.getByRole("button", { name: "기간 선택" }));
    for (const label of ["최근 7일", "이번달", "최근 3개월", "최근 1년"]) {
      expect(screen.getByRole("menuitem", { name: label })).toBeInTheDocument();
    }
    management.mockResolvedValue(stats("1m", { buckets: [{ key: "w1", start_date: "2026-07-01", end_date: "2026-07-05", label: "1주", study_seconds: 600, is_current: true }] }));
    await userEvent.click(screen.getByRole("menuitem", { name: "이번달" }));
    await waitFor(() => expect(management).toHaveBeenCalledWith("1m", expect.anything()));
    expect(await screen.findByText("1주")).toBeInTheDocument();
  });

  it("shows an error with retry (not the empty state) when the request fails", async () => {
    management.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("문제가 생겼어요")).toBeInTheDocument();
    expect(screen.queryByText("학습 기록이 아직 없어요")).not.toBeInTheDocument();
  });

  it("navigates to Personalized Learning from the empty-state CTA", async () => {
    management.mockResolvedValue(stats("7d", { has_any_eligible_learning_record: false }));
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /학습 시작하기/ }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/recommend"));
  });

  it("back button navigates to Home", async () => {
    renderPage();
    await screen.findByText("목");
    await userEvent.click(screen.getByRole("button", { name: "뒤로" }));
    await waitFor(() => expect(screen.getByTestId("loc")).toHaveTextContent("/home"));
  });
});
