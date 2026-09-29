import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { LeagueLifecycleResponse, LeagueResultSummary } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  gameApi: { leagueLifecycle: vi.fn(), ackLeagueResult: vi.fn() },
}));

import { gameApi } from "../api/endpoints";
import { LeagueResult } from "./LeagueResult";
import { I18nProvider } from "../i18n";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const promoted: LeagueResultSummary = {
  season_id: "2026-W27",
  previous_tier: "green",
  // The server's labels are English whatever the app language.
  previous_tier_label: "Green League",
  resulting_tier: "lime",
  resulting_tier_label: "Lime League",
  final_rank: 5,
  total_participants: 30,
  outcome: "promoted",
  promote_cutoff_rank: 6,
  settled_at: "2026-07-12T21:00:00Z",
  viewed: false,
};

function lifecycle(result: LeagueResultSummary | null): LeagueLifecycleResponse {
  return {
    state: result ? "RESULT_UNVIEWED" : "ACTIVE_LEAGUE",
    previous_result: result,
    current_season_id: "2026-W28",
    next_season_starts_at: null,
    can_join_current: false,
  };
}

function renderResult() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/league/result"]}>
            <Routes>
              <Route path="/league/result" element={<LeagueResult />} />
              <Route path="/league" element={<div>LEAGUE_HOME</div>} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.leagueLifecycle.mockResolvedValue(lifecycle(promoted));
  api.ackLeagueResult.mockResolvedValue(lifecycle(null));
});

describe("League result screen", () => {
  it("renders the resulting league icon, promotion title, real rank and outcome copy", async () => {
    renderResult();
    // Resulting-league icon (Lime), not the previous league.
    expect(await screen.findByRole("img", { name: "Lime 리그" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "축하합니다!" })).toBeInTheDocument();
    // Real threshold + target league, real final rank.
    expect(screen.getByText(/상위 6위 안에 들어/)).toBeInTheDocument();
    // Composed in Korean — not the server's English "Lime League".
    expect(screen.getByText(/Lime 리그로 승급했어요/)).toBeInTheDocument();
    expect(screen.getByText("최종 순위 5위 / 30명")).toBeInTheDocument();
  });

  it("no longer renders the node-based league progression", async () => {
    renderResult();
    await screen.findByRole("heading", { name: "축하합니다!" });
    expect(screen.queryByRole("list", { name: "리그 진행" })).not.toBeInTheDocument();
    ["Green", "Lime", "Yellow", "Orange", "Golden"].forEach((label) =>
      expect(screen.queryByText(label)).not.toBeInTheDocument(),
    );
  });

  it("계속 도전하기 acknowledges exactly once and returns to the league screen", async () => {
    renderResult();
    const btn = await screen.findByRole("button", { name: "계속 도전하기" });
    await userEvent.click(btn);
    await userEvent.click(btn); // ignored while pending
    await waitFor(() => expect(api.ackLeagueResult).toHaveBeenCalledTimes(1));
    expect(api.ackLeagueResult).toHaveBeenCalledWith("2026-W27");
    expect(await screen.findByText("LEAGUE_HOME")).toBeInTheDocument();
  });

  it("renders retention copy for a retained result", async () => {
    api.leagueLifecycle.mockResolvedValue(
      lifecycle({ ...promoted, outcome: "retained", resulting_tier: "green", resulting_tier_label: "Green League" }),
    );
    renderResult();
    expect(await screen.findByRole("heading", { name: "잘 버텼어요!" })).toBeInTheDocument();
    expect(screen.getByText(/Green 리그를 지켜냈어요/)).toBeInTheDocument();
  });

  it("renders demotion copy for a demoted result", async () => {
    api.leagueLifecycle.mockResolvedValue(
      lifecycle({ ...promoted, outcome: "demoted", resulting_tier: "green", resulting_tier_label: "Green League" }),
    );
    renderResult();
    expect(await screen.findByRole("heading", { name: "아쉬워요..." })).toBeInTheDocument();
  });

  it("offers a retry when the result cannot be loaded", async () => {
    // Regression: an error kept the screen on its loading spinner forever.
    api.leagueLifecycle.mockRejectedValueOnce(new Error("down"));
    renderResult();
    await userEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("heading", { name: "축하합니다!" })).toBeInTheDocument();
  });

  it("redirects to the league screen when there is no settled result", async () => {
    api.leagueLifecycle.mockResolvedValue(lifecycle(null));
    renderResult();
    expect(await screen.findByText("LEAGUE_HOME")).toBeInTheDocument();
  });
});
