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

const position = { season_id: "2026-W28", tier: "lime", tier_label: "Lime 리그", dormant: false, group_id: "g", group_size: 30, rank: 3, season_points: 100 };
const seasonInfo = { season_id: "2026-W28", starts_at: "2026-07-13T04:00:00Z", ends_at: "2026-07-19T21:00:00Z", is_current: true };
const rankings = { season_id: "2026-W28", group_id: "g", entries: [{ rank: 1, user_id: "u1", nickname: "가", points: 200, profile_image_type: "NONE" }], me: { rank: 1, user_id: "u1", nickname: "가", points: 200, profile_image_type: "NONE" } };

function renderLeague() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/league"]}>
            <Routes>
              <Route path="/league" element={<League />} />
              <Route path="/league/result" element={<div>RESULT_SCREEN</div>} />
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

  it("WAITING shows a preparing modal that cannot be dismissed", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    renderLeague();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
    // No action/close button — nothing to dismiss it.
    expect(within(dialog).queryByRole("button")).not.toBeInTheDocument();
    // Backdrop click and Escape do not close it.
    await userEvent.click(document.querySelector(".llc") as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
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

  it("restores the correct lifecycle state on remount (server-driven)", async () => {
    api.leagueLifecycle.mockResolvedValue(waiting);
    const { unmount } = renderLeague();
    expect(await screen.findByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
    unmount();
    renderLeague(); // "app restart"
    expect(await screen.findByRole("heading", { name: "다음 리그를 준비 중이에요!" })).toBeInTheDocument();
  });
});
