import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const pad = (n: number) => String(n).padStart(2, "0");
/** Build a month payload where the given day numbers are learning days
 *  (`studied`), optionally forcing `goal_achieved` off to prove the marker
 *  follows the learning-day rule, not the daily goal. */
function mkCal(year: number, month: number, studiedDays: number[], opts?: { goalAchieved?: boolean }) {
  const days = studiedDays.map((d) => ({
    date: `${year}-${pad(month)}-${pad(d)}`,
    studied: true,
    goal_achieved: opts?.goalAchieved ?? false,
    is_today: false,
  }));
  return {
    current_streak: studiedDays.length,
    best_streak: 9,
    freeze_tokens: 0,
    month: { year, month, days, studied_days: studiedDays.length, goal_achieved_days: 0 },
  };
}

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

describe("Streak calendar — completed-day markers", () => {
  // The calendar-completion tests key off learning days, not the sun/today.
  beforeEach(() => summary.mockResolvedValue({ studied_today: false }));

  const pill = (day: number, y = 2026, m = 7) =>
    screen.queryByLabelText(`${y}년 ${m}월 ${day}일, 학습 완료`);

  it("marks a learning day with a pill showing the date number and 완료", async () => {
    // Day 2 studied but goal NOT achieved → still marked (learning-day rule).
    streakCalendar.mockResolvedValue(mkCal(2026, 7, [2], { goalAchieved: false }));
    renderStreak();
    const marker = await screen.findByLabelText("2026년 7월 2일, 학습 완료");
    expect(within(marker).getByText("2")).toBeInTheDocument();
    expect(within(marker).getByText("완료")).toBeInTheDocument();
  });

  it("does not mark a day without learning activity", async () => {
    streakCalendar.mockResolvedValue(mkCal(2026, 7, [2]));
    renderStreak();
    await screen.findByLabelText("2026년 7월 2일, 학습 완료");
    // Day 5 has no activity → plain cell, no pill.
    expect(pill(5)).not.toBeInTheDocument();
    expect(screen.getByLabelText("2026년 7월 5일")).toBeInTheDocument();
  });

  it("renders no pills when the month has no learning days", async () => {
    streakCalendar.mockResolvedValue(mkCal(2026, 7, []));
    renderStreak();
    await screen.findByLabelText("2026년 7월 1일"); // grid rendered
    expect(screen.queryAllByText("완료")).toHaveLength(0);
  });

  it("marks several learning days in the same month, each with its own pill", async () => {
    streakCalendar.mockResolvedValue(mkCal(2026, 7, [2, 3, 10]));
    renderStreak();
    await screen.findByLabelText("2026년 7월 2일, 학습 완료");
    expect(pill(3)).toBeInTheDocument();
    expect(pill(10)).toBeInTheDocument();
    expect(screen.getAllByText("완료")).toHaveLength(3);
  });

  it("updates markers when navigating to the previous month", async () => {
    streakCalendar.mockImplementation((_y: number, m: number) =>
      Promise.resolve(m === 6 ? mkCal(2026, 6, [15]) : mkCal(2026, 7, [2])),
    );
    renderStreak();
    await screen.findByLabelText("2026년 7월 2일, 학습 완료");

    await userEvent.click(screen.getByLabelText("이전 달"));

    // June's marker appears; July's is gone.
    expect(await screen.findByLabelText("2026년 6월 15일, 학습 완료")).toBeInTheDocument();
    expect(screen.queryByLabelText("2026년 7월 2일, 학습 완료")).not.toBeInTheDocument();
    expect(screen.getAllByText("완료")).toHaveLength(1);
  });

  it("marks today from the sun state even if the calendar day isn't yet counted", async () => {
    // Calendar reports no studied days, but the sun says the user studied today.
    summary.mockResolvedValue({ studied_today: true });
    const today = new Date();
    streakCalendar.mockResolvedValue(mkCal(today.getFullYear(), today.getMonth() + 1, []));
    renderStreak();
    const label = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일, 학습 완료`;
    expect(await screen.findByLabelText(label)).toBeInTheDocument();
  });
});
