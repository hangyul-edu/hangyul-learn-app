import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { SessionLevelUp } from "../lib/types";
import { LevelUp } from "./LevelUp";

const conv: SessionLevelUp = {
  track_id: "track_conversation",
  previous_level: 1,
  current_level: 2,
  seconds_studied_at_previous_level: 3600,
  items_studied_at_previous_level: 10,
  points_awarded: 100,
};
const topik: SessionLevelUp = {
  track_id: "track_topik",
  previous_level: 1,
  current_level: 2,
  seconds_studied_at_previous_level: 1500,
  items_studied_at_previous_level: 5,
  points_awarded: 100,
};

function renderLevelUp(levelUp?: SessionLevelUp) {
  const router = createMemoryRouter(
    [
      { path: "/level-up", element: <LevelUp /> },
      { path: "/session/conversation", element: <div>SESSION_CONVERSATION</div> },
      { path: "/session/topik", element: <div>SESSION_TOPIK</div> },
      { path: "/home", element: <div>HOME</div> },
    ],
    { initialEntries: [{ pathname: "/level-up", state: levelUp ? { levelUp } : undefined }], initialIndex: 0 },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("LevelUp screen", () => {
  it("renders conversation level-up data-driven (heading, pill, reward, stats)", () => {
    renderLevelUp(conv);
    expect(screen.getByText(/레벨 2 달성/)).toBeInTheDocument();
    expect(screen.getByText("Lv.1")).toBeInTheDocument();
    expect(screen.getByText("Lv.2")).toBeInTheDocument();
    expect(screen.getByText("+100p")).toBeInTheDocument();
    expect(screen.getByText("01:00")).toBeInTheDocument(); // 3600s → HH:mm
    expect(screen.getByText("학습한 문장")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("대단한걸!✨")).toBeInTheDocument();
  });

  it("uses TOPIK wording (급 + 학습한 문제)", () => {
    renderLevelUp(topik);
    expect(screen.getByText(/토픽 2급 달성/)).toBeInTheDocument();
    expect(screen.getByText("1급")).toBeInTheDocument();
    expect(screen.getByText("2급")).toBeInTheDocument();
    expect(screen.getByText("학습한 문제")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("00:25")).toBeInTheDocument(); // 1500s → 00:25
  });

  it("button starts the next personalized session for the SAME track (conversation)", async () => {
    renderLevelUp(conv);
    await userEvent.click(screen.getByRole("button", { name: "다음 레벨 학습하기" }));
    expect(await screen.findByText("SESSION_CONVERSATION")).toBeInTheDocument();
  });

  it("button routes to the TOPIK session for a TOPIK level-up", async () => {
    renderLevelUp(topik);
    await userEvent.click(screen.getByRole("button", { name: "다음 레벨 학습하기" }));
    expect(await screen.findByText("SESSION_TOPIK")).toBeInTheDocument();
  });

  it("redirects home when there is no level-up state (refresh / direct nav)", async () => {
    renderLevelUp(undefined);
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(screen.queryByText(/달성/)).not.toBeInTheDocument();
  });
});
