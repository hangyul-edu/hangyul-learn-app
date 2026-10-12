/**
 * A member held to the daily-goal cap who picks a higher goal gets the
 * cp_G_03_toast notice (Figma 744:46726 / 784:63104) and keeps their goal.
 * Premium members, testers and admins (`daily_goal_limit: null`) never see it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";

const toastShow = vi.fn();
vi.mock("../hooks/toast", () => ({
  useToast: () => ({ show: toastShow, error: vi.fn(), success: vi.fn() }),
}));

const { learning } = vi.hoisted(() => ({ learning: vi.fn() }));
vi.mock("../api/endpoints", () => ({ settingsApi: { learning, updateLearningCategory: vi.fn() } }));

import { TrackSettings } from "./TrackSettings";

const CATEGORIES = [
  { category: "conversation", level: 2, daily_goal: 5, max_level: 10, order: 1 },
  { category: "topik", level: 1, daily_goal: 5, max_level: 6, order: 2 },
];

function renderTrack(category: string, language: AppLanguage = "ko") {
  const router = createMemoryRouter(
    [{ path: "/recommend/settings/:category", element: <TrackSettings /> }],
    { initialEntries: [`/recommend/settings/${category}`] },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nProvider language={language}>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function goalRadios(groupName: string) {
  const group = await screen.findByRole("radiogroup", { name: groupName });
  return within(group).getAllByRole("radio");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TrackSettings — daily-goal limit notice", () => {
  it("shows the notice and keeps the goal when a capped member picks above the cap", async () => {
    learning.mockResolvedValue({ categories: CATEGORIES, daily_goal_limit: 5 });
    renderTrack("conversation");
    const radios = await goalRadios("하루 목표");
    await userEvent.click(radios[2]); // 20

    expect(toastShow).toHaveBeenCalledWith(
      "하루 목표는 최대 5개까지 설정할 수 있어요\n프리미엄에서는 무제한 이용이 가능해요 ✨",
      "notice",
    );
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[2]).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "저장하기" })).toBeDisabled();
  });

  it("uses the English copy, counting questions on the TOPIK screen", async () => {
    learning.mockResolvedValue({ categories: CATEGORIES, daily_goal_limit: 5 });
    renderTrack("topik", "en");
    await userEvent.click((await goalRadios("Daily Target"))[1]);
    expect(toastShow).toHaveBeenCalledWith(
      "Daily goal can be set up to 5 questions\nGo Premium for unlimited ✨",
      "notice",
    );
  });

  it("stays quiet when a capped member picks the cap itself", async () => {
    learning.mockResolvedValue({ categories: CATEGORIES, daily_goal_limit: 5 });
    renderTrack("conversation");
    await userEvent.click((await goalRadios("하루 목표"))[0]);
    expect(toastShow).not.toHaveBeenCalled();
  });

  it("never shows it to unlimited users (premium, tester, admin)", async () => {
    learning.mockResolvedValue({ categories: CATEGORIES, daily_goal_limit: null });
    renderTrack("conversation");
    const radios = await goalRadios("하루 목표");
    await userEvent.click(radios[4]); // 40

    expect(toastShow).not.toHaveBeenCalled();
    expect(radios[4]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "저장하기" })).toBeEnabled();
  });
});
