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
  it("puts each of the top three on their own block with their name and rank", async () => {
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    const place = (rank: number) => document.querySelector(`.fl__place--r${rank}`) as HTMLElement;
    expect(within(place(1)).getByText("Hai")).toBeInTheDocument();
    expect(within(place(2)).getByText("Hoa")).toBeInTheDocument();
    expect(within(place(3)).getByText("Beam")).toBeInTheDocument();
    for (const rank of [1, 2, 3]) {
      expect(place(rank).querySelector(`.fl__block--r${rank} .fl__block-rank`)?.textContent).toBe(String(rank));
      // LEG-010's blocks are flat colours now: no darker right-hand strip.
      expect(place(rank).querySelector(".fl__strip")).toBeNull();
      expect(place(rank).querySelector(".fl__block img")).toBeNull();
    }
    // Each place is announced with its rank, name and points.
    expect(place(2)).toHaveAttribute("aria-label", expect.stringContaining("Hoa"));
  });

  it("shows the 2nd and 3rd friends' own avatars (60px) beside the champion's (80px)", async () => {
    api.friendRankings.mockResolvedValue({
      ...full,
      entries: [
        { ...full.entries[0], profile_image_type: "AVATAR", avatar_key: "AVATAR_02" },
        { ...full.entries[1], profile_image_type: "AVATAR", avatar_key: "AVATAR_01" },
        full.entries[2],
        ...full.entries.slice(3),
      ],
    });
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    const avatar = (rank: number) =>
      document.querySelector(`.fl__podium-avatar--r${rank} .rank-avatar-char`) as HTMLElement;
    expect(avatar(1).style.width).toBe("80px");
    expect(avatar(2).style.width).toBe("60px");
    expect(avatar(3).style.width).toBe("60px");
    // A real character for those who chose one; the no-image disc otherwise —
    // never the old decorative placeholders.
    expect(avatar(2).querySelector("img")?.getAttribute("src")).not.toBe(
      avatar(3).querySelector("img")?.getAttribute("src"),
    );
    expect(document.querySelector(".fl__decor")).toBeNull();
    expect(document.querySelectorAll(".fl__drop")).toHaveLength(4);
    expect(document.querySelector(".fl__platform")).toBeInTheDocument();
    // Each character sits where LEG-010 puts it: the champion's AVATAR_02 box
    // 5.9% of the circle below its centre (4.72px at 80), Hoa's AVATAR_01
    // almost centred — not the profile picker's ink centring.
    expect(avatar(1).querySelector("img")?.style.transform).toBe("translate(-0.112px, 4.720px) rotate(3.77deg)");
    expect(avatar(2).querySelector("img")?.style.transform).toBe("translate(-0.378px, 0.096px)");
  });

  it('writes "-" for a friend who has never been in a league', async () => {
    api.friendRankings.mockResolvedValue({
      ...full,
      entries: [...full.entries, { ...entry(6, "u6", "Maria", "", 0), tier: null }],
    });
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    const rows = within(list).getAllByRole("listitem");
    expect(within(rows[5]).getByText("-")).toBeInTheDocument();
    expect(within(rows[5]).queryByText(/리그/)).toBeNull();
  });

  it("names a friend without a nickname generically, on the podium and in the list", async () => {
    // The server sends null until the friend picks a nickname (it used to send
    // their internal user id, which the screen then printed).
    api.friendRankings.mockResolvedValue({
      ...full,
      entries: [full.entries[0], { ...full.entries[1], nickname: null }, ...full.entries.slice(2)],
    });
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    expect(within(document.querySelector(".fl__place--r2") as HTMLElement).getByText("회원")).toBeInTheDocument();
    expect(within(within(list).getAllByRole("listitem")[1]).getByText("회원")).toBeInTheDocument();
    expect(screen.queryByText("u2")).toBeNull();
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
    // Outlined add button carrying the exported ic_24_plus glyph (LEG-011
    // 1658:23890), not a raw '+' and not a hand-drawn path.
    const add = screen.getByRole("button", { name: "친구 추가" });
    const plus = add.querySelector("img.ic-plus");
    expect(plus).toBeInTheDocument();
    expect(add.querySelector("svg")).toBeNull();
    // No podium in the empty state.
    expect(document.querySelector(".fl__hero")).not.toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "No friends in your league yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("does not show the empty state for a real fetch error (retryable)", async () => {
    api.friendRankings.mockReset();
    api.friendRankings.mockRejectedValue(new Error("network"));
    renderFriend();
    expect(await screen.findByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("친구 리그에 참가할 친구가 없어요")).not.toBeInTheDocument();
  });

  it("shows a shared rank as the server gives it, on the podium and in the list", async () => {
    // Hai and Hoa tie for 1st; Beam and Taro tie for 3rd (1, 1, 3, 3, 5).
    api.friendRankings.mockResolvedValue({
      ...full,
      entries: [
        entry(1, "u1", "Hai", "golden", 2000),
        entry(1, "u2", "Hoa", "orange", 2000),
        entry(3, "u3", "Beam", "orange", 1000),
        entry(3, "me", "Taro", "yellow", 1000),
        entry(5, "u5", "Yuta", "yellow", 200),
      ],
      me: entry(3, "me", "Taro", "yellow", 1000),
    });
    renderFriend();
    const list = await screen.findByRole("list", { name: "친구 리그 순위" });
    // The blocks keep their places; the numbers on them are the friends' ranks.
    const block = (place: number) => document.querySelector(`.fl__place--r${place} .fl__block-rank`)?.textContent;
    expect([block(1), block(2), block(3)]).toEqual(["1", "1", "3"]);
    expect(document.querySelector(".fl__place--r2")).toHaveAttribute("aria-label", expect.stringContaining("1위"));
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.querySelector(".fl__row-no")?.textContent)).toEqual(["1", "1", "3", "3", "5"]);
    // Everyone ranked 3rd or better has a medal, ties included.
    expect(rows.map((row) => row.querySelectorAll(".rank-medal").length)).toEqual([1, 1, 1, 1, 0]);
  });

  it("supports a 2-participant fallback (no rank-3 podium)", async () => {
    api.friendRankings.mockResolvedValue({ ...full, entries: full.entries.slice(0, 2), me: full.entries[1] });
    renderFriend();
    await screen.findByLabelText("친구 리그 순위");
    expect(document.querySelector(".fl__place--r1 .fl__block-rank")?.textContent).toBe("1");
    expect(document.querySelector(".fl__place--r2 .fl__block-rank")?.textContent).toBe("2");
    // The 3rd block stands empty: no place, no avatar.
    expect(document.querySelector(".fl__place--r3")).toBeNull();
    expect(document.querySelector(".fl__block--r3.is-empty")).toBeInTheDocument();
    expect(document.querySelectorAll(".fl__podium-avatar")).toHaveLength(2);
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
