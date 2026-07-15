import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { LeaguePosition, LeagueSeason, RankingResponse } from "../lib/types";

/* -------------------------------- mocks --------------------------------- */
vi.mock("../api/endpoints", () => ({
  gameApi: {
    myLeague: vi.fn(),
    currentSeason: vi.fn(),
    currentRankings: vi.fn(),
    friendRankings: vi.fn(),
  },
}));

import { gameApi } from "../api/endpoints";
import { League } from "./League";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

/* ------------------------------ fixtures -------------------------------- */
// Current tier = yellow (index 2): green/lime/yellow are reached, orange/golden locked.
const position: LeaguePosition = {
  season_id: "2026-W28",
  tier: "yellow",
  tier_label: "Yellow 리그",
  dormant: false,
  group_id: "grp-1",
  group_size: 30,
  rank: 3,
  season_points: 2000,
};

const season: LeagueSeason = {
  season_id: "2026-W28",
  starts_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  // ~1일 5시간 remaining, so the timer renders a real countdown.
  ends_at: new Date(Date.now() + 29 * 3_600_000).toISOString(),
  is_current: true,
};

const rankings: RankingResponse = {
  season_id: "2026-W28",
  group_id: "grp-1",
  league_kind: "regular",
  entries: [
    { rank: 1, user_id: "u1", nickname: "가나", points: 3200, profile_image_type: "NONE" },
    { rank: 2, user_id: "u2", nickname: "다라", points: 2600, profile_image_type: "AVATAR", avatar_key: "AVATAR_01" },
    { rank: 3, user_id: "me", nickname: "나야", points: 2000, profile_image_type: "CUSTOM", profile_image_url: "https://img/me.png" },
    { rank: 4, user_id: "u4", nickname: "마바", points: 1400, profile_image_type: "NONE" },
    { rank: 5, user_id: "u5", nickname: "사아", points: 900, profile_image_type: "NONE" },
  ],
  me: { rank: 3, user_id: "me", nickname: "나야", points: 2000, profile_image_type: "CUSTOM", profile_image_url: "https://img/me.png" },
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/league"]}>
        <Routes>
          <Route path="/league" element={<League />} />
          <Route path="/points" element={<div>POINTS_SCREEN</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let scrollIntoView: ReturnType<typeof vi.fn>;
let scrollTo: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  scrollIntoView = vi.fn();
  scrollTo = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
  api.myLeague.mockResolvedValue(position);
  api.currentSeason.mockResolvedValue(season);
  api.currentRankings.mockResolvedValue(rankings);
  api.friendRankings.mockResolvedValue({ ...rankings, league_kind: "friend" });
});

describe("League screen", () => {
  it("renders the fixed tier title, countdown, and 정규 리그 tab underlined", async () => {
    renderScreen();
    expect(await screen.findByText("Yellow 리그")).toBeInTheDocument();
    // Active sub-tab carries the underline class; others do not.
    const regular = screen.getByRole("tab", { name: "정규 리그" });
    expect(regular).toHaveClass("is-active");
    expect(regular).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "친구 리그" })).not.toHaveClass("is-active");
    // Countdown is derived from real season timing, not hardcoded.
    expect(screen.getByText(/남은 시간:/)).toHaveTextContent(/\d+일 \d+시간 \d+분/);
  });

  it("renders every tier in ladder order with the current league centered", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    const badges = screen.getAllByRole("img", { name: /리그/ });
    // 5 tiers in the carousel (order: green→golden).
    const labels = badges.map((b) => b.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/Green 리그/);
    expect(labels[4]).toMatch(/Golden 리그/);
    // The current (yellow) badge is marked current; future ones are locked.
    expect(labels[2]).toMatch(/현재 리그/);
    expect(labels[3]).toMatch(/잠김/); // orange, not yet reached
    expect(labels[4]).toMatch(/잠김/); // golden, not yet reached
    expect(labels[0]).not.toMatch(/잠김/); // green, reached
  });

  it("keeps the fixed title unchanged when the carousel is scrolled (it is not a selector)", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    const carousel = screen.getByLabelText("리그 진행 상황");
    fireEvent.scroll(carousel);
    fireEvent.pointerUp(carousel);
    // Swiping the progress icons must not change the league title.
    expect(screen.getByText("Yellow 리그")).toBeInTheDocument();
  });

  it("renders ranking rows with points as P, medals only for the top 3", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    expect(screen.getByText("2000P")).toBeInTheDocument();
    expect(screen.getByText("3200P")).toBeInTheDocument();
    // Rank 3 is me → highlighted row.
    const meRow = screen.getByRole("listitem", { name: /나야/ });
    expect(meRow).toHaveClass("is-me");
    // Medals live in svg on ranks 1-3 only. Ranks 4 & 5 have none.
    const rows = screen.getAllByRole("listitem");
    const svgCount = (li: HTMLElement) => li.querySelectorAll("svg").length;
    // Row 4 (마바) and row 5 (사아) have just the avatar's markup, no medal svg.
    const row4 = screen.getByRole("listitem", { name: /마바/ });
    const row5 = screen.getByRole("listitem", { name: /사아/ });
    expect(svgCount(row4)).toBe(0);
    expect(svgCount(row5)).toBe(0);
    // Row 1 (top) does carry a medal svg.
    expect(svgCount(rows[0])).toBeGreaterThan(0);
  });

  it("scrolls the current user's row into view once the board loads (anchor)", async () => {
    renderScreen();
    await screen.findByText("2000P");
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
  });

  it("opens the info modal with schedule, point rules, and promotion sections", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    await userEvent.click(screen.getByRole("button", { name: "리그 안내 열기" }));
    const dialog = await screen.findByRole("dialog", { name: "정규 리그 안내" });
    expect(within(dialog).getByRole("heading", { name: "정규 리그" })).toBeInTheDocument();
    expect(within(dialog).getByText(/매주 월요일 00:00 시작/)).toBeInTheDocument();
    expect(within(dialog).getByText("(일요일 21시에 결과 발표)")).toBeInTheDocument();
    // Point-rule cards.
    expect(within(dialog).getByText("출석")).toBeInTheDocument();
    expect(within(dialog).getByText("맞춤 학습")).toBeInTheDocument();
    expect(within(dialog).getByText("강의")).toBeInTheDocument();
    // Promotion rule.
    expect(within(dialog).getByText("상위 20%만 다음 리그로 승급")).toBeInTheDocument();
    expect(within(dialog).getByText("Green: 강등 없음")).toBeInTheDocument();
    // Close it.
    await userEvent.click(within(dialog).getByRole("button", { name: "닫기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the empty state only for a dormant user, never the ranking board", async () => {
    api.myLeague.mockResolvedValue({ ...position, dormant: true, group_id: null, rank: null, season_points: 0 });
    renderScreen();
    expect(await screen.findByText("아직 참가 중인 리그가 없어요")).toBeInTheDocument();
    expect(screen.getByText(/리그에 도전해보세요!/)).toBeInTheDocument();
    // No ranking rows and no countdown for a dormant user.
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(screen.queryByText(/남은 시간:/)).not.toBeInTheDocument();
  });

  it("does not flash the empty state while loading", async () => {
    let resolve!: (v: LeaguePosition) => void;
    api.myLeague.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();
    // Still loading → the dormant empty-state copy must not appear.
    expect(screen.queryByText("아직 참가 중인 리그가 없어요")).not.toBeInTheDocument();
    resolve(position);
    expect(await screen.findByText("Yellow 리그")).toBeInTheDocument();
  });

  it("navigates to /points from the 히스토리 button", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    await userEvent.click(screen.getByRole("button", { name: "리그 히스토리 보기" }));
    expect(await screen.findByText("POINTS_SCREEN")).toBeInTheDocument();
  });

  it("switches to the friend league board on the 친구 리그 tab", async () => {
    renderScreen();
    await screen.findByText("Yellow 리그");
    await userEvent.click(screen.getByRole("tab", { name: "친구 리그" }));
    await waitFor(() => expect(api.friendRankings).toHaveBeenCalled());
    // The friend board replaces the tier title; the carousel/timer are gone.
    expect(screen.getByText("친구 리그", { selector: ".lg__title" })).toBeInTheDocument();
    expect(screen.queryByLabelText("리그 진행 상황")).not.toBeInTheDocument();
  });

  it("shows a retryable error when the league fails to load", async () => {
    api.myLeague.mockRejectedValueOnce(new Error("network down"));
    renderScreen();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    api.myLeague.mockResolvedValueOnce(position);
    await userEvent.click(retry);
    expect(await screen.findByText("Yellow 리그")).toBeInTheDocument();
  });
});
