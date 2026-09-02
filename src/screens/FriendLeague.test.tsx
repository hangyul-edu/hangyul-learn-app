import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { RankingResponse } from "../lib/types";

vi.mock("../api/endpoints", () => ({
  gameApi: { friendRankings: vi.fn() },
  // AddFriendSheet (opened from the empty state) talks to friendApi.
  friendApi: {
    recommendations: vi.fn().mockResolvedValue({ recommendations: [] }),
    searchPhone: vi.fn(),
    request: vi.fn(),
    cancel: vi.fn(),
    accept: vi.fn(),
    createInvitation: vi.fn().mockResolvedValue({ token: "tok" }),
  },
}));
let mockLang: "ko" | "en" = "ko";
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({ me: { app_language: mockLang } }),
  useAuthOptional: () => ({ me: { app_language: mockLang } }),
}));

import { gameApi } from "../api/endpoints";
import { FriendLeague } from "./FriendLeague";
import { I18nProvider } from "../i18n";

const api = gameApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const entry = (rank: number, id: string, name: string, tier: string, points: number) => ({
  rank,
  user_id: id,
  nickname: name,
  profile_image_type: "NONE" as const,
  tier,
  points,
});

const full: RankingResponse = {
  season_id: "2026-W28",
  league_kind: "friend",
  entries: [
    entry(1, "u1", "Hai", "golden", 2000),
    entry(2, "u2", "Hoa", "orange", 1500),
    entry(3, "u3", "Beam", "orange", 1000),
    entry(4, "me", "Taro", "yellow", 500),
    entry(5, "u5", "Yuta", "yellow", 200),
  ],
  me: entry(4, "me", "Taro", "yellow", 500),
};

function renderFriend() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // Mirrors <LanguageSync>: the provider adopts the profile language.
    <I18nProvider language={mockLang}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/league"]}>
            <Routes>
              <Route path="/league" element={<FriendLeague />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLang = "ko";
  api.friendRankings.mockResolvedValue(full);
});

describe("Friend League screen", () => {
  it("renders the top-3 podium in 2 / 1 / 3 order with rank 1 tallest and centered", async () => {
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    const cols = document.querySelectorAll(".fl__podiums .fl__col");
    expect(cols).toHaveLength(3);
    // DOM order is left→center→right = rank 2, 1, 3.
    expect(cols[0].querySelector(".fl__block-rank")?.textContent).toBe("2");
    expect(cols[1].querySelector(".fl__block-rank")?.textContent).toBe("1");
    expect(cols[2].querySelector(".fl__block-rank")?.textContent).toBe("3");
    // Rank 1 block is the tallest tier class, and only rank 1 has the champion avatar.
    expect(cols[1].querySelector(".fl__block--r1")).toBeInTheDocument();
    expect(cols[1].querySelector(".fl__champion")).toBeInTheDocument();
    expect(cols[0].querySelector(".fl__champion")).not.toBeInTheDocument();
  });

  it("renders decorative placeholder avatars and the base platform", async () => {
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    expect(document.querySelector(".fl__decor--left")).toBeInTheDocument();
    expect(document.querySelector(".fl__decor--right")).toBeInTheDocument();
    expect(document.querySelector(".fl__platform")).toBeInTheDocument();
  });

  it("renders the full ranking list with league subtitle and points-as-P", async () => {
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    // Subtitle comes from each friend's real tier (derived label).
    expect(within(rows[0]).getByText("Golden 리그")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Orange 리그")).toBeInTheDocument();
    expect(within(rows[0]).getByText("2000P")).toBeInTheDocument();
    expect(within(rows[3]).getByText("500P")).toBeInTheDocument();
  });

  it("shows medals for ranks 1–3 only", async () => {
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    const rows = within(list).getAllByRole("listitem");
    const medalCount = (li: HTMLElement) => li.querySelectorAll(".rank-medal").length;
    expect(medalCount(rows[0])).toBeGreaterThan(0);
    expect(medalCount(rows[1])).toBeGreaterThan(0);
    expect(medalCount(rows[2])).toBeGreaterThan(0);
    expect(medalCount(rows[3])).toBe(0);
    expect(medalCount(rows[4])).toBe(0);
  });

  it("highlights only the current user's row and exposes it to a11y", async () => {
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    const meRow = within(list).getByRole("listitem", { name: /현재 사용자/ });
    expect(meRow).toHaveClass("is-me");
    expect(meRow).toHaveAttribute("aria-label", "4위, Taro, Yellow 리그, 500포인트, 현재 사용자");
    // Exactly one highlighted row.
    expect(list.querySelectorAll(".fl__row.is-me")).toHaveLength(1);
  });

  it("renders the minimal empty state (heading + two-line desc + 친구 추가) with no friends", async () => {
    // Only the caller participates → confirmed empty result.
    api.friendRankings.mockResolvedValue({ ...full, entries: [full.entries[3]], me: full.entries[3] });
    renderFriend();
    const heading = await screen.findByRole("heading", { name: "친구 리그에 참가할 친구가 없어요" });
    expect(heading).toBeInTheDocument();
    // Two-line description (one <p> split by <br/>).
    const desc = document.querySelector(".fl-empty__desc") as HTMLElement;
    expect(desc.textContent).toContain("친구를 추가하고");
    expect(desc.textContent).toContain("함께 경쟁해보세요!");
    expect(desc.querySelector("br")).toBeInTheDocument();
    // Outlined add button with a plus icon (SVG, not a raw '+').
    const add = screen.getByRole("button", { name: "친구 추가" });
    expect(add.querySelector("svg")).toBeInTheDocument();
    // No podium in the empty state.
    expect(document.querySelector(".fl__podiums")).not.toBeInTheDocument();
  });

  it("친구 추가 opens the Add Friend bottom sheet in place (no navigation)", async () => {
    api.friendRankings.mockResolvedValue({ ...full, entries: [full.entries[3]], me: full.entries[3] });
    renderFriend();
    await userEvent.click(await screen.findByRole("button", { name: "친구 추가" }));
    // Opens the Add Friend sheet over the League page — stays on /league.
    expect(await screen.findByRole("dialog", { name: "친구 추가" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 추가 닫기" })).toBeInTheDocument();
  });

  it("renders English empty-state copy for an English user", async () => {
    mockLang = "en";
    api.friendRankings.mockResolvedValue({ ...full, entries: [full.entries[3]], me: full.entries[3] });
    renderFriend();
    expect(await screen.findByRole("heading", { name: "No friends can join your Friend League yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Friend" })).toBeInTheDocument();
  });

  it("does not show the empty state for a real fetch error (retryable)", async () => {
    api.friendRankings.mockReset();
    api.friendRankings.mockRejectedValue(new Error("network"));
    renderFriend();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("친구 리그에 참가할 친구가 없어요")).not.toBeInTheDocument();
  });

  it("supports a 2-participant fallback (no rank-3 podium)", async () => {
    api.friendRankings.mockResolvedValue({ ...full, entries: full.entries.slice(0, 2), me: full.entries[1] });
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    const cols = document.querySelectorAll(".fl__podiums .fl__col");
    expect(cols[1].querySelector(".fl__block-rank")?.textContent).toBe("1");
    expect(cols[0].querySelector(".fl__block-rank")?.textContent).toBe("2");
    // Rank-3 slot is an empty placeholder block.
    expect(cols[2].querySelector(".fl__block.is-empty")).toBeInTheDocument();
  });

  it("does not flash the empty state while loading", async () => {
    let resolve!: (v: RankingResponse) => void;
    api.friendRankings.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderFriend();
    expect(screen.queryByText("아직 친구 리그에 참가한 친구가 없어요")).not.toBeInTheDocument();
    resolve(full);
    await screen.findByLabelText("친구 리그 순위");
  });

  it("shows a retryable error when the ranking fails", async () => {
    api.friendRankings.mockRejectedValueOnce(new Error("boom"));
    renderFriend();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    api.friendRankings.mockResolvedValue(full);
    await userEvent.click(retry);
    await screen.findByLabelText("친구 리그 순위");
  });
});
