import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { LeagueLifecycleResponse } from "../lib/types";

/* -------------------------------- mocks --------------------------------- */
vi.mock("../api/endpoints", () => ({
  gameApi: {
    myLeague: vi.fn(),
    currentSeason: vi.fn(),
    currentRankings: vi.fn(),
    friendRankings: vi.fn(),
    leagueLifecycle: vi.fn(),
    joinCurrentLeague: vi.fn(),
    ackLeagueResult: vi.fn(),
    points: vi.fn(),
    pointsHistory: vi.fn(),
  },
  // The 친구 리그 tab mounts the Add Friend sheet.
  friendApi: {
    recommendations: vi.fn().mockResolvedValue({ recommendations: [] }),
    createInvitation: vi.fn().mockResolvedValue({ token: "tok" }),
  },
}));

import { gameApi } from "../api/endpoints";
import { League } from "./League";
import { I18nProvider } from "../i18n";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const active: LeagueLifecycleResponse = {
  state: "ACTIVE_LEAGUE",
  previous_result: null,
  current_season_id: "2026-W28",
  next_season_starts_at: null,
  can_join_current: false,
};
const newLeague: LeagueLifecycleResponse = {
  ...active,
  state: "NEW_LEAGUE_AVAILABLE_NOT_JOINED",
  can_join_current: true,
};
const resultUnviewed: LeagueLifecycleResponse = {
  state: "RESULT_UNVIEWED",
  previous_result: {
    season_id: "2026-W27",
    previous_tier: "green",
    previous_tier_label: "Green 리그",
    resulting_tier: "lime",
    resulting_tier_label: "Lime 리그",
    final_rank: 5,
    total_participants: 30,
    outcome: "promoted",
    promote_cutoff_rank: 6,
    settled_at: "2026-07-12T21:00:00Z",
    viewed: false,
  },
  current_season_id: "2026-W28",
  next_season_starts_at: null,
  can_join_current: false,
};
const waiting: LeagueLifecycleResponse = {
  ...resultUnviewed,
  state: "RESULT_VIEWED_WAITING_NEXT_LEAGUE",
  next_season_starts_at: "2026-07-20T04:00:00Z",
};
/** Studied, earned a league, and every league in their tier is full. */
const unallocated: LeagueLifecycleResponse = {
  ...active,
  state: "WAITING_FOR_ALLOCATION",
};

const position = { season_id: "2026-W28", tier: "lime", tier_label: "Lime 리그", dormant: false, group_id: "g", group_size: 30, rank: 3, season_points: 100 };
const seasonInfo = { season_id: "2026-W28", starts_at: "2026-07-13T04:00:00Z", ends_at: "2026-07-19T21:00:00Z", is_current: true };
const rankings = { season_id: "2026-W28", group_id: "g", entries: [{ rank: 1, user_id: "u1", nickname: "가", points: 200, profile_image_type: "NONE" }], me: { rank: 1, user_id: "u1", nickname: "가", points: 200, profile_image_type: "NONE" } };

function renderLeague(path = "/league") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/league" element={<League />} />
              <Route path="/league/result" element={<div>RESULT_SCREEN</div>} />
              <Route path="/league/history" element={<div>HISTORY_SCREEN</div>} />
              <Route path="/home" element={<div>HOME_SCREEN</div>} />
              <Route path="/points" element={<div>POINTS</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  api.myLeague.mockResolvedValue(position);
  api.currentSeason.mockResolvedValue(seasonInfo);
  api.currentRankings.mockResolvedValue(rankings);
  api.friendRankings.mockResolvedValue(rankings);
  api.leagueLifecycle.mockResolvedValue(active);
  api.points.mockResolvedValue({ user_id: "u1", season_points: 120 });
  api.pointsHistory.mockResolvedValue({ items: [], next_cursor: null });
});

/* Every state in which the member has no regular league to play in. The
   lifecycle modal is that league's business; 친구 리그, My 포인트 and 히스토리
   work without one and must stay reachable. */
const noRegularLeague: [string, LeagueLifecycleResponse][] = [
  ["new league not joined", newLeague],
  ["result unviewed", resultUnviewed],
  ["between weeks", waiting],
  ["waiting for allocation", unallocated],
];

describe.each(noRegularLeague)("with no regular league (%s)", (_label, state) => {
  beforeEach(() => {
    api.leagueLifecycle.mockResolvedValue(state);
    // The caller and one friend — enough for the podium and list.
    api.friendRankings.mockResolvedValue({
      ...rankings,
      league_kind: "friend",
      entries: [...rankings.entries, { rank: 2, user_id: "u2", nickname: "나", points: 50, profile_image_type: "NONE", tier: null }],
    });
  });

  it("the tabs stay usable: 친구 리그 and My 포인트 open without the modal", async () => {
    renderLeague();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "친구 리그" }));
    await waitFor(() => expect(api.friendRankings).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "친구 리그 순위" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "My 포인트" }));
    await waitFor(() => expect(api.points).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Back on 정규 리그 the regular league's state is shown again.
    await userEvent.click(screen.getByRole("tab", { name: "정규 리그" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("히스토리 opens from the 정규 리그 tab while the modal is up", async () => {
    renderLeague();
    await screen.findByRole("dialog");
    await userEvent.click(screen.getByRole("button", { name: "리그 히스토리 보기" }));
    expect(await screen.findByText("HISTORY_SCREEN")).toBeInTheDocument();
  });

  it("deep links to 친구 리그 and My 포인트 open straight in", async () => {
    const { unmount } = renderLeague("/league?tab=friend");
    expect(await screen.findByRole("list", { name: "친구 리그 순위" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    unmount();
    renderLeague("/league?tab=points");
    await waitFor(() => expect(api.points).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("League lifecycle gate", () => {
  it("ACTIVE renders the normal ranking screen with no lifecycle modal", async () => {
    renderLeague();
    expect(await screen.findByText("Lime 리그")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not flash the ranking/empty screen before lifecycle is known", async () => {
    let resolve!: (v: LeagueLifecycleResponse) => void;
    api.leagueLifecycle.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderLeague();
    // Body gated → no ranking rows yet.
    expect(screen.queryByText("2000P")).not.toBeInTheDocument();
    resolve(active);
    await waitFor(() => expect(api.myLeague).toHaveBeenCalled());
  });

  it("NEW_LEAGUE_AVAILABLE shows the '리그가 시작됐어요!' modal", async () => {
    api.leagueLifecycle.mockResolvedValue(newLeague);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "리그가 시작됐어요!" })).toBeInTheDocument();
    expect(within(dialog).getByText("지금부터 학습하면 순위가 바로 반영돼요")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "바로 참여하기" })).toBeInTheDocument();
    // Exactly one lifecycle modal at a time.
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("바로 참여하기 calls join once (dedup) and closes the modal on success", async () => {
    api.leagueLifecycle.mockResolvedValue(newLeague);
    let resolveJoin!: (v: LeagueLifecycleResponse) => void;
    api.joinCurrentLeague.mockReturnValue(new Promise((r) => { resolveJoin = r; }));
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    const btn = within(dialog).getByRole("button", { name: "바로 참여하기" });
    await userEvent.click(btn);
    await userEvent.click(btn); // ignored while pending
    expect(api.joinCurrentLeague).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();
    resolveJoin(active); // server confirms → ACTIVE
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("a join failure keeps the modal open and re-enables the button", async () => {
    api.leagueLifecycle.mockResolvedValue(newLeague);
    api.joinCurrentLeague.mockRejectedValueOnce(new Error("network"));
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "바로 참여하기" }));
    await waitFor(() => expect(api.joinCurrentLeague).toHaveBeenCalled());
    // Modal preserved, actionable again.
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "바로 참여하기" })).not.toBeDisabled();
  });

  it("RESULT_UNVIEWED shows the previous-result modal (priority over new-league)", async () => {
    api.leagueLifecycle.mockResolvedValue(resultUnviewed);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "지난 리그가 마무리됐어요!" })).toBeInTheDocument();
    expect(within(dialog).queryByText("리그가 시작됐어요!")).not.toBeInTheDocument();
  });

  it("결과 보러가기 navigates to the result screen", async () => {
    api.leagueLifecycle.mockResolvedValue(resultUnviewed);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "결과 보러가기" }));
    expect(await screen.findByText("RESULT_SCREEN")).toBeInTheDocument();
  });

  it("WAITING shows a preparing modal that only its CTA can leave", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
    // 3329:37278 draws exactly one action — no close/dismiss affordance.
    expect(within(dialog).getAllByRole("button")).toHaveLength(1);
    // Backdrop click and Escape still do not close it.
    await userEvent.click(document.querySelector(".llc") as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("preparing modal's CTA navigates Home instead of trapping the user", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    // 3329:37283 (KO) — the button added by the redraw.
    await userEvent.click(within(dialog).getByRole("button", { name: "홈화면으로 돌아가기" }));
    expect(await screen.findByText("HOME_SCREEN")).toBeInTheDocument();
  });

  it("preparing modal shows the dynamic next-start time (ET), not a hardcode", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    // 784:57731 quotes the league boundary in US Eastern, its authoritative zone.
    expect(within(dialog).getByText(/\(ET\)에 시작됩니다/)).toBeInTheDocument();
  });

  it("swaps preparing → new-league when the backend reports availability on foreground", async () => {
    api.leagueLifecycle.mockResolvedValueOnce(waiting).mockResolvedValue(newLeague);
    renderLeague();
    // Initially waiting.
    expect(await screen.findByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
    // App returns to foreground → lifecycle refetch → new league available.
    document.dispatchEvent(new Event("visibilitychange"));
    expect(await screen.findByRole("heading", { name: "리그가 시작됐어요!" })).toBeInTheDocument();
    expect(screen.queryByText("다음 리그를 준비 중이에요!")).not.toBeInTheDocument();
  });

  it("WAITING_FOR_ALLOCATION says a league is coming, not that one is late", async () => {
    // The member has studied — they are owed a league and every league in
    // their tier is full. Falling through to the screen's dormant invitation
    // would tell somebody who just finished a lesson to go and study.
    api.leagueLifecycle.mockResolvedValue(unallocated);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    // 3451:27236 (KO), verbatim.
    expect(
      within(dialog).getByRole("heading", { name: "리그 배정을 기다리고 있어요!" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("함께할 학습자가 모이면 리그가 시작돼요"),
    ).toBeInTheDocument();
  });

  it("does not present the allocation wait as an error", async () => {
    api.leagueLifecycle.mockResolvedValue(unallocated);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    // Announced as status, never alert: a screen reader must not hear this as
    // something going wrong.
    const desc = within(dialog).getByText("함께할 학습자가 모이면 리그가 시작돼요");
    expect(desc).toHaveAttribute("role", "status");
    expect(within(dialog).queryByRole("alert")).toBeNull();
    // One action, and it is the way out — not a retry, which would imply a
    // failed request the member could re-run. Nothing they do resolves this.
    const buttons = within(dialog).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("홈화면으로 돌아가기");
  });

  it("tells the allocation wait apart from the between-weeks wait", async () => {
    // Both are "waiting", and only one of them knows when it ends. Sharing a
    // modal would mean either inventing a start time or dropping it.
    api.leagueLifecycle.mockResolvedValue(unallocated);
    const { unmount } = renderLeague();
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/\(ET\)에 시작됩니다/)).toBeNull();
    unmount();

    api.leagueLifecycle.mockResolvedValue(waiting);
    renderLeague();
    dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("heading", { name: "리그 배정을 기다리고 있어요!" }),
    ).toBeNull();
    expect(within(dialog).getByText(/\(ET\)에 시작됩니다/)).toBeInTheDocument();
  });

  it("the allocation wait's CTA goes Home rather than trapping the member", async () => {
    api.leagueLifecycle.mockResolvedValue(unallocated);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "홈화면으로 돌아가기" }),
    );
    expect(await screen.findByText("HOME_SCREEN")).toBeInTheDocument();
  });

  it("restores the correct lifecycle state on remount (server-driven)", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    const { unmount } = renderLeague();
    expect(await screen.findByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
    unmount();
    renderLeague(); // "app restart"
    expect(await screen.findByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
  });
});
