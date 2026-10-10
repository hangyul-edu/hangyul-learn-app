/**
 * Saving a track's level / daily goal shows the cp_G_01_modals success dialog
 * (Figma 2677:26018 / 2678:26321), and only its button returns to the
 * settings list. A failed save shows no dialog.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";

const toastError = vi.fn();
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: toastError, success: vi.fn() }) }));

const { learning, updateLearningCategory } = vi.hoisted(() => ({
  learning: vi.fn(),
  updateLearningCategory: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({ settingsApi: { learning, updateLearningCategory } }));

import { TrackSettings } from "./TrackSettings";

const PREFS = {
  categories: [
    { category: "conversation", level: 2, daily_goal: 5, max_level: 10, display_order: 1 },
    { category: "topik", level: 1, daily_goal: 5, max_level: 6, display_order: 2 },
  ],
};

function Path() {
  return <div data-testid="path">{useLocation().pathname}</div>;
}

function renderTrack(language: AppLanguage = "ko") {
  const router = createMemoryRouter(
    [
      { path: "/recommend/settings", element: <><div>LIST</div><Path /></> },
      { path: "/recommend/settings/:category", element: <><TrackSettings /><Path /></> },
    ],
    { initialEntries: ["/recommend/settings", "/recommend/settings/conversation"], initialIndex: 1 },
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

async function pickAnotherLevel(groupName: string) {
  const group = await screen.findByRole("radiogroup", { name: groupName });
  await userEvent.click(within(group).getAllByRole("radio")[3]);
}

beforeEach(() => {
  vi.clearAllMocks();
  learning.mockResolvedValue(PREFS);
});

describe("TrackSettings — saved modal", () => {
  it("shows the saved dialog after a successful save and returns to the list only on 확인", async () => {
    updateLearningCategory.mockResolvedValue(PREFS);
    renderTrack();
    await pickAnotherLevel("레벨 선택");
    await userEvent.click(screen.getByRole("button", { name: "저장하기" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "학습 설정이 저장됐습니다" })).toBeInTheDocument();
    expect(within(dialog).getByText("변경하신 레벨과 하루 목표로 학습이 진행 돼요")).toBeInTheDocument();
    expect(dialog).toHaveAccessibleName("학습 설정이 저장됐습니다");
    expect(screen.getByTestId("path")).toHaveTextContent("/recommend/settings/conversation"); // waits for 확인

    await userEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent(/^\/recommend\/settings$/));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the English frame's copy verbatim", async () => {
    updateLearningCategory.mockResolvedValue(PREFS);
    renderTrack("en");
    await pickAnotherLevel("Choose Level");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Practice Settings Saved" })).toBeInTheDocument();
    expect(within(dialog).getByText("Your level and daily goal have been updated")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "OK" })).toBeInTheDocument();
  });

  it("shows no dialog when the save fails", async () => {
    updateLearningCategory.mockRejectedValue(new Error("boom"));
    renderTrack();
    await pickAnotherLevel("레벨 선택");
    await userEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("path")).toHaveTextContent("/recommend/settings/conversation");
  });
});
