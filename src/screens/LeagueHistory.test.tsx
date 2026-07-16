import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { LeagueHistoryResponse, LeagueHistorySeasonsResponse } from "../lib/types";

/* -------------------------------- mocks --------------------------------- */
vi.mock("../api/endpoints", () => ({
  gameApi: {
    leagueHistorySeasons: vi.fn(),
    leagueHistory: vi.fn(),
  },
}));
let mockLang = "ko";
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: mockLang } }) }));

import { gameApi } from "../api/endpoints";
import { LeagueHistory } from "./LeagueHistory";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

/* ------------------------------ fixtures -------------------------------- */
const seasonsResp: LeagueHistorySeasonsResponse = {
  default_season_id: "2026-spring",
  seasons: [
    { season_id: "2026-summer", year: 2026, quarter: "summer", label: "2026 여름 시즌", starts_at: "2026-06-01T04:00:00Z", ends_at: "2026-09-01T04:00:00Z", is_current: false },
    { season_id: "2026-spring", year: 2026, quarter: "spring", label: "2026 봄 시즌", starts_at: "2026-03-01T05:00:00Z", ends_at: "2026-06-01T04:00:00Z", is_current: true },
    { season_id: "2026-winter", year: 2026, quarter: "winter", label: "2026 겨울 시즌", starts_at: "2025-12-01T05:00:00Z", ends_at: "2026-03-01T05:00:00Z", is_current: false },
  ],
};

const springPage1: LeagueHistoryResponse = {
  season: seasonsResp.seasons[1],
  next_cursor: "CURSOR2",
  items: [
    { league_week_id: "2026-W18", season_id: "2026-spring", week_start: "2026-04-27", week_end: "2026-05-03", is_current: true, rank: 30, points: 2000, tier: "green", tier_label: "Green 리그" },
    { league_week_id: "2026-W17", season_id: "2026-spring", week_start: "2026-04-20", week_end: "2026-04-26", is_current: false, rank: 10, points: 1800, tier: "green", tier_label: "Green 리그" },
  ],
};
const springPage2: LeagueHistoryResponse = {
  season: seasonsResp.seasons[1],
  next_cursor: null,
  items: [
    { league_week_id: "2026-W16", season_id: "2026-spring", week_start: "2026-04-13", week_end: "2026-04-19", is_current: false, rank: 1, points: 1500, tier: "green", tier_label: "Green 리그" },
  ],
};
const summerPage: LeagueHistoryResponse = {
  season: seasonsResp.seasons[0],
  next_cursor: null,
  items: [
    { league_week_id: "2026-W24", season_id: "2026-summer", week_start: "2026-06-08", week_end: "2026-06-14", is_current: false, rank: 3, points: 900, tier: "lime", tier_label: "Lime 리그" },
  ],
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/league", "/league/history"]} initialIndex={1}>
        <Routes>
          <Route path="/league" element={<div>LEAGUE_SCREEN</div>} />
          <Route path="/league/history" element={<LeagueHistory />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Route history() calls to the right season's page(s).
function routeHistory() {
  api.leagueHistory.mockImplementation(({ seasonId, cursor }: { seasonId?: string; cursor?: string } = {}) => {
    if (seasonId === "2026-summer") return Promise.resolve(summerPage);
    if (cursor === "CURSOR2") return Promise.resolve(springPage2);
    return Promise.resolve(springPage1);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLang = "ko";
  Element.prototype.scrollIntoView = vi.fn();
  api.leagueHistorySeasons.mockResolvedValue(seasonsResp);
  routeHistory();
});

describe("League History screen", () => {
  it("renders the header, default season hero, and first-page rows", async () => {
    renderScreen();
    expect(screen.getByRole("heading", { name: "리그 히스토리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "뒤로 가기" })).toBeInTheDocument();
    // Hero shows the default (current) season, data-driven.
    expect(await screen.findByText("봄 시즌 리그")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    // First page rows: date range + points-as-P.
    expect(await screen.findByText("04.27~05.03")).toBeInTheDocument();
    expect(screen.getByText("2000P")).toBeInTheDocument();
    // Loaded with the default season id.
    expect(api.leagueHistory).toHaveBeenCalledWith({ seasonId: "2026-spring" });
  });

  it("never flashes a season-load error while adopting the default season", async () => {
    renderScreen();
    // Between seasons-loaded and default-season-adopted there is a render tick;
    // it must show loading, not the '시즌 정보를 불러오지 못했어요' error.
    await screen.findByText("봄 시즌 리그");
    expect(screen.queryByText("시즌 정보를 불러오지 못했어요.")).not.toBeInTheDocument();
  });

  it("marks the ongoing week with a 진행 중 pill (only that week)", async () => {
    renderScreen();
    await screen.findByText("04.27~05.03");
    const ongoing = screen.getAllByText("진행 중");
    expect(ongoing).toHaveLength(1);
    // The pill sits on the current week's row.
    const currentRow = screen.getByText("04.27~05.03").closest("li")!;
    expect(within(currentRow).getByText("진행 중")).toBeInTheDocument();
    const pastRow = screen.getByText("04.20~04.26").closest("li")!;
    expect(within(pastRow).queryByText("진행 중")).not.toBeInTheDocument();
  });

  it("opens the season dropdown with the current season highlighted", async () => {
    renderScreen();
    await screen.findByText("봄 시즌 리그");
    await userEvent.click(screen.getByRole("button", { name: /시즌 변경/ }));
    const listbox = await screen.findByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["2026 여름 시즌", "2026 봄 시즌", "2026 겨울 시즌"]);
    const spring = within(listbox).getByRole("option", { name: "2026 봄 시즌" });
    expect(spring).toHaveAttribute("aria-selected", "true");
    expect(spring).toHaveClass("is-active");
  });

  it("reloads only the chosen season's records when the season changes", async () => {
    renderScreen();
    await screen.findByText("04.27~05.03");
    await userEvent.click(screen.getByRole("button", { name: /시즌 변경/ }));
    await userEvent.click(screen.getByRole("option", { name: "2026 여름 시즌" }));
    // Hero updates and the previous season's rows are gone.
    expect(await screen.findByText("여름 시즌 리그")).toBeInTheDocument();
    await waitFor(() => expect(api.leagueHistory).toHaveBeenCalledWith({ seasonId: "2026-summer" }));
    expect(await screen.findByText("06.08~06.14")).toBeInTheDocument();
    expect(screen.queryByText("04.27~05.03")).not.toBeInTheDocument();
    // Dropdown closed after select.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("paginates on sentinel intersection, appending without duplicates", async () => {
    let trigger: () => void = () => {};
    // Capture the observer callback so we can simulate the sentinel scrolling in.
    (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class {
      cb: (e: { isIntersecting: boolean }[]) => void;
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        this.cb = cb;
        trigger = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    } as unknown as typeof IntersectionObserver;

    renderScreen();
    await screen.findByText("04.27~05.03");
    // Page 1 rows present, page 2 not yet.
    expect(screen.queryByText("04.13~04.19")).not.toBeInTheDocument();
    trigger();
    // Page 2 appended.
    expect(await screen.findByText("04.13~04.19")).toBeInTheDocument();
    // No duplicated rows after append.
    expect(screen.getAllByText("04.27~05.03")).toHaveLength(1);
    // Cursor exhausted → no further fetches on repeat intersection.
    const callsAfter = api.leagueHistory.mock.calls.length;
    trigger();
    await waitFor(() => expect(api.leagueHistory.mock.calls.length).toBe(callsAfter));
  });

  it("shows the empty state for a season with no records", async () => {
    api.leagueHistory.mockResolvedValue({ season: seasonsResp.seasons[1], next_cursor: null, items: [] });
    renderScreen();
    expect(await screen.findByText("이 시즌의 리그 기록이 없어요")).toBeInTheDocument();
    expect(screen.getByText("참여한 리그 기록이 생기면 여기에 표시됩니다.")).toBeInTheDocument();
  });

  it("shows a retryable error when the list fails to load", async () => {
    api.leagueHistory.mockRejectedValueOnce(new Error("boom"));
    renderScreen();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    routeHistory();
    await userEvent.click(retry);
    expect(await screen.findByText("04.27~05.03")).toBeInTheDocument();
  });

  it("returns to the previous screen from the back button", async () => {
    renderScreen();
    await screen.findByText("봄 시즌 리그");
    await userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(await screen.findByText("LEAGUE_SCREEN")).toBeInTheDocument();
  });

  it("renders the decorative hanging banner and a circular tier icon per row", async () => {
    renderScreen();
    await screen.findByText("04.27~05.03");
    expect(document.querySelector(".lh__banner")).toBeInTheDocument();
    // One circular tier icon per row.
    expect(document.querySelectorAll(".lh__rows .lh__tier")).toHaveLength(2);
  });

  it("uses a colored top-3 pennant for rank 1-3 and a gray one for rank 4+", async () => {
    // Page 2 has rank 1; page 1 has rank 30 (gray) and rank 10 (gray).
    renderScreen();
    const rank30Row = (await screen.findByText("04.27~05.03")).closest("li")!;
    expect(within(rank30Row).getByText("30")).toBeInTheDocument();
    // Rank 30 pennant is not a top-3 (no yellow accent).
    expect(rank30Row.querySelector(".lh__pennant.is-top3")).not.toBeInTheDocument();
    expect(rank30Row.querySelector(".lh__pennant")).toBeInTheDocument();
  });

  it("marks the rank-1 row's pennant as top-3 (colored accent)", async () => {
    api.leagueHistory.mockResolvedValue({ ...springPage2, next_cursor: null }); // single rank-1 row
    renderScreen();
    const row = (await screen.findByText("04.13~04.19")).closest("li")!;
    expect(within(row).getByText("1")).toBeInTheDocument();
    expect(row.querySelector(".lh__pennant.is-top3")).toBeInTheDocument();
  });

  it("exposes an accessible label with tier, dates, status, rank, and points", async () => {
    renderScreen();
    const currentRow = (await screen.findByText("04.27~05.03")).closest("li")!;
    // e.g. "Green 리그, 4월 27일부터 5월 3일까지, 진행 중, 현재 30위, 2000포인트"
    const label = currentRow.getAttribute("aria-label") ?? "";
    expect(label).toContain("Green 리그");
    expect(label).toContain("진행 중");
    expect(label).toContain("30위");
    expect(label).toContain("2000포인트");
  });

  it("renders English chrome for an English user", async () => {
    mockLang = "en";
    renderScreen();
    expect(await screen.findByRole("heading", { name: "League History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    expect(await screen.findByText("Spring League")).toBeInTheDocument();
    // Ongoing pill localized.
    await screen.findByText("04.27~05.03");
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});
