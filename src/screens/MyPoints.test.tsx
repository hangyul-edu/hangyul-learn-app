import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PointsHistoryResponse, PointTransaction } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  gameApi: { points: vi.fn(), pointsHistory: vi.fn() },
}));
let mockLang: "ko" | "en" = "ko";
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: mockLang } }) }));

import { gameApi } from "../api/endpoints";
import { MyPoints } from "./MyPoints";
import { I18nProvider } from "../i18n";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const tx = (
  id: string,
  reason: string,
  amount: number,
  occurred_at: string,
  detail: Record<string, unknown> | null = null,
  league_period_id = "2026-W29",
): PointTransaction => ({ event_id: id, reason, amount, occurred_at, detail, league_period_id });

// Newest-first, spanning July and June (different weekly leagues).
const history: PointsHistoryResponse = {
  next_cursor: null,
  items: [
    tx("e1", "attendance_streak_bonus", 10, "2026-07-17T12:00:00Z", { streak_days: 7 }, "2026-W29"),
    tx("e2", "attendance", 5, "2026-07-17T11:00:00Z", { kind: "daily" }, "2026-W29"),
    tx("e3", "lecture_complete", 100, "2026-07-16T12:00:00Z", { track: "track_topik" }, "2026-W29"),
    tx("e4", "sentence_complete", 10, "2026-06-15T12:00:00Z", { item_type: "question" }, "2026-W24"),
    tx("e5", "saved_sentence_review", 5, "2026-06-14T12:00:00Z", { item_type: "sentence" }, "2026-W24"),
  ],
};

function renderPoints() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // Mirrors <LanguageSync>: the provider adopts the profile language.
    <I18nProvider language={mockLang}>
      <QueryClientProvider client={qc}>
        <MyPoints />
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLang = "ko";
  api.points.mockResolvedValue({ user_id: "u", season_points: 1000 });
  api.pointsHistory.mockResolvedValue(history);
});

describe("My Points screen", () => {
  it("shows the current-league label (not a season label) and the API total with separators + p", async () => {
    renderPoints();
    expect(await screen.findByText("이번 리그 포인트")).toBeInTheDocument();
    expect(screen.queryByText("이번 시즌 포인트")).not.toBeInTheDocument();
    // Thousands-separated total from the API + soft 'p' suffix.
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByText("p")).toBeInTheDocument();
  });

  it("total comes from the API summary, not the sum of loaded transactions", async () => {
    // Items sum to 130, but the current-league total is the authoritative 1000.
    renderPoints();
    expect(await screen.findByText("1,000")).toBeInTheDocument();
    expect(screen.queryByText("130")).not.toBeInTheDocument();
  });

  it("groups transactions by local month, newest month first", async () => {
    renderPoints();
    await screen.findByText("이번 리그 포인트");
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual(["2026년 7월", "2026년 6월"]);
    // Within July, newest first (streak bonus before daily).
    const julyList = screen.getAllByRole("list")[0];
    const rows = within(julyList).getAllByRole("listitem");
    expect(within(rows[0]).getByText("연속 7일 출석 보너스")).toBeInTheDocument();
    expect(within(rows[1]).getByText("일일 출석")).toBeInTheDocument();
  });

  it("maps each reason to a title + description from the persisted detail", async () => {
    renderPoints();
    await screen.findByText("이번 리그 포인트");
    // Attendance streak
    expect(screen.getAllByText("출석 체크").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("연속 7일 출석 보너스")).toBeInTheDocument();
    // Course
    expect(screen.getByText("강의 시청")).toBeInTheDocument();
    expect(screen.getByText("강의 시청 완료")).toBeInTheDocument();
    // Customized learning (question)
    expect(screen.getByText("맞춤 학습")).toBeInTheDocument();
    expect(screen.getByText("문제 학습 완료")).toBeInTheDocument();
    // Review (sentence)
    expect(screen.getByText("복습")).toBeInTheDocument();
    expect(screen.getByText("문장 복습 완료")).toBeInTheDocument();
  });

  it("renders each transaction's persisted amount + date, and an a11y label", async () => {
    renderPoints();
    await screen.findByText("이번 리그 포인트");
    expect(screen.getByText("+100 P")).toBeInTheDocument();
    expect(screen.getAllByText("+5 P")).toHaveLength(2); // daily attendance + review
    const streakRow = screen.getByText("연속 7일 출석 보너스").closest("li")!;
    expect(within(streakRow).getByText("+10 P")).toBeInTheDocument();
    const label = streakRow.getAttribute("aria-label") ?? "";
    expect(label).toContain("출석 체크");
    expect(label).toContain("10포인트");
  });

  it("shows 0 p for a new league while still listing prior-league history", async () => {
    api.points.mockResolvedValue({ user_id: "u", season_points: 0 });
    renderPoints();
    expect(await screen.findByText("0")).toBeInTheDocument();
    // History from previous weekly leagues is still visible.
    expect(screen.getByText("강의 시청")).toBeInTheDocument();
  });

  it("does not flash 0 p while the total is loading", async () => {
    let resolve!: (v: { user_id: string; season_points: number }) => void;
    api.points.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderPoints();
    expect(screen.queryByText("이번 리그 포인트")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    resolve({ user_id: "u", season_points: 1000 });
    expect(await screen.findByText("1,000")).toBeInTheDocument();
  });

  it("renders the empty state after a successful empty response", async () => {
    api.pointsHistory.mockResolvedValue({ items: [], next_cursor: null });
    renderPoints();
    expect(await screen.findByText("아직 이번 리그에서 적립된 포인트가 없어요")).toBeInTheDocument();
  });

  it("shows a retryable error when the total fails", async () => {
    api.points.mockRejectedValueOnce(new Error("boom"));
    renderPoints();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    api.points.mockResolvedValue({ user_id: "u", season_points: 1000 });
    await userEvent.click(retry);
    expect(await screen.findByText("1,000")).toBeInTheDocument();
  });

  it("renders English chrome + copy for an English user", async () => {
    mockLang = "en";
    renderPoints();
    expect(await screen.findByText("Points in This League")).toBeInTheDocument();
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText("Course completed")).toBeInTheDocument();
    expect(screen.getByText("7-day attendance streak bonus")).toBeInTheDocument();
  });

  it("paginates on sentinel intersection, appending without duplicates", async () => {
    let trigger: () => void = () => {};
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        trigger = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;

    api.pointsHistory.mockReset();
    api.pointsHistory
      .mockResolvedValueOnce({ items: history.items.slice(0, 3), next_cursor: "C2" })
      .mockResolvedValue({ items: history.items.slice(3), next_cursor: null });

    renderPoints();
    await screen.findByText("강의 시청"); // page 1 present
    expect(screen.queryByText("문제 학습 완료")).not.toBeInTheDocument();
    trigger();
    expect(await screen.findByText("문제 학습 완료")).toBeInTheDocument();
    // No duplicate rows after append.
    expect(screen.getAllByText("강의 시청")).toHaveLength(1);
  });
});
