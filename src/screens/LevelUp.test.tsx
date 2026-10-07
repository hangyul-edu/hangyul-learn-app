import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { ProficiencyCelebration } from "../lib/types";
import { LevelUp } from "./LevelUp";
import { I18nProvider } from "../i18n";

const conv: ProficiencyCelebration = {
  track: "conversation",
  from_level: 4,
  to_level: 5,
  reward_points: 100,
  capabilities_confirmed: 6,
  from: "/proficiency/conversation",
};
const topik: ProficiencyCelebration = {
  track: "topik",
  from_level: null,
  to_level: 3,
  reward_points: 100,
  capabilities_confirmed: 0,
  from: "/proficiency/topik",
};

function renderLevelUp(celebration?: ProficiencyCelebration) {
  const router = createMemoryRouter(
    [
      { path: "/level-up", element: <LevelUp /> },
      { path: "/home", element: <div>HOME</div> },
      { path: "/proficiency/:track", element: <div>PROFICIENCY</div> },
    ],
    { initialEntries: [{ pathname: "/level-up", state: celebration ? { celebration } : undefined }], initialIndex: 0 },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("LevelUp screen (evidence-based promotions only)", () => {
  it("celebrates a confirmed conversation level with what it rested on", () => {
    renderLevelUp(conv);
    expect(screen.getByText("회화 레벨 5 확인!")).toBeInTheDocument();
    expect(screen.getByText("Lv.4")).toBeInTheDocument();
    expect(screen.getByText("Lv.5")).toBeInTheDocument();
    expect(screen.getByText("+100p")).toBeInTheDocument();
    expect(screen.getByText("확인한 필수 역량")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    // The retired rule's statistics are gone: time and item counts never
    // justified a level.
    expect(screen.queryByText("공부한 시간")).not.toBeInTheDocument();
    expect(screen.queryByText("학습한 문장")).not.toBeInTheDocument();
  });

  it("labels TOPIK readiness as app-mock based, never an official grade", () => {
    renderLevelUp(topik);
    expect(screen.getByText("TOPIK 3급 준비도 확인! 🎉")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // no confirmed grade before
    expect(screen.getByText("3급")).toBeInTheDocument();
    expect(screen.getByText(/공식 TOPIK 성적이 아니에요/)).toBeInTheDocument();
  });

  it("returns to the proficiency page, which shows the evidence", async () => {
    renderLevelUp(conv);
    await userEvent.click(screen.getByRole("button", { name: "다음 레벨 학습하기" }));
    expect(await screen.findByText("PROFICIENCY")).toBeInTheDocument();
  });

  it("redirects home when there is no decision to celebrate (refresh / direct nav)", async () => {
    renderLevelUp(undefined);
    expect(await screen.findByText("HOME")).toBeInTheDocument();
    expect(screen.queryByText(/확인!/)).not.toBeInTheDocument();
  });
});
