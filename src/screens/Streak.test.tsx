import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { streakCalendar, summary } = vi.hoisted(() => ({
  streakCalendar: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { streakCalendar },
  dashboardApi: { summary },
}));

import { Streak } from "./Streak";
import { SUN_COPY } from "../components/DailyLearningSun";

const CAL = {
  current_streak: 4,
  best_streak: 9,
  freeze_tokens: 0,
  month: { year: 2026, month: 7, days: [], studied_days: 0, goal_achieved_days: 0 },
};

function renderStreak() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Streak />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  streakCalendar.mockResolvedValue(CAL);
});

describe("Streak banner — today-study state", () => {
  it("shows the inactive copy + off sun when the user has not studied today", async () => {
    summary.mockResolvedValue({ studied_today: false });
    renderStreak();
    // The <br/> splits the copy into sibling text nodes, so match by substring.
    expect(await screen.findByText(/연속 학습이 멈췄어요/)).toBeInTheDocument();
    expect(screen.getByText(/학습하면 태양이 다시 빛날 거예요!/)).toBeInTheDocument();
    // Sun settles into the off state, and the active copy is never present
    // (no off-sun + active-copy mix).
    expect(await screen.findByLabelText(SUN_COPY.unlit)).toBeInTheDocument();
    expect(screen.queryByText(/태양이 빛나는 중/)).not.toBeInTheDocument();
  });

  it("shows the active copy + on sun when the user has studied today", async () => {
    summary.mockResolvedValue({ studied_today: true });
    renderStreak();
    expect(await screen.findByText(/태양이 빛나는 중/)).toBeInTheDocument();
    expect(screen.getByText(/꾸준히 4일!/)).toBeInTheDocument();
    expect(screen.getByLabelText(SUN_COPY.lit)).toBeInTheDocument();
    expect(screen.queryByText(/연속 학습이 멈췄어요/)).not.toBeInTheDocument();
  });

  it("flips inactive → active when the shared dashboard cache updates", async () => {
    summary.mockResolvedValue({ studied_today: false });
    const { qc } = renderStreak();
    expect(await screen.findByText(/연속 학습이 멈췄어요/)).toBeInTheDocument();
    // A qualifying study action patches the shared ["dashboard"] query.
    qc.setQueryData(["dashboard"], { studied_today: true });
    await waitFor(() => expect(screen.getByText(/태양이 빛나는 중/)).toBeInTheDocument());
    expect(screen.getByLabelText(SUN_COPY.lit)).toBeInTheDocument();
    expect(screen.queryByText(/연속 학습이 멈췄어요/)).not.toBeInTheDocument();
  });
});
