import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";

/* -------------------------------- mocks --------------------------------- */
let mockMe: { app_language: string } | null = { app_language: "en" };
const setMe = vi.fn();
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe, setMe }) }));
vi.mock("../api/endpoints", () => ({
  settingsApi: { language: vi.fn(), setLanguage: vi.fn() },
}));

import { settingsApi } from "../api/endpoints";
import { LanguageSettings } from "./LanguageSettings";

const api = settingsApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

/**
 * `language` is the app language the screen renders in — what <LanguageSync>
 * would have adopted from the profile. It is deliberately separate from
 * `mockMe.app_language`, which drives the *persisted* value the radio cards
 * reflect; a save changes the app language while the persisted value is
 * reconciled from the server response.
 */
function renderScreen(language: AppLanguage = "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // Data router — required for the unsaved-changes useBlocker guard.
  const router = createMemoryRouter(
    [
      // The page is reached from the More/Profile page and leaves back to it.
      { path: "/profile", element: <div>PROFILE_SCREEN</div> },
      { path: "/settings/language", element: <LanguageSettings /> },
    ],
    { initialEntries: ["/profile", "/settings/language"], initialIndex: 1 },
  );
  return render(
    <I18nProvider language={language}>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const card = (label: string) => screen.getByRole("radio", { name: new RegExp(label) });
const modal = () => screen.queryByRole("alertdialog");

beforeEach(() => {
  vi.clearAllMocks();
  mockMe = { app_language: "en" };
  api.language.mockResolvedValue({ app_language: "en" });
  api.setLanguage.mockResolvedValue({ app_language: "ko" });
});

describe("LanguageSettings screen", () => {
  it("renders header, back button, and English/한국어 in order with native labels", async () => {
    renderScreen();
    expect(await screen.findByRole("heading", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent("English");
    expect(radios[1]).toHaveTextContent("한국어");
  });

  it("selects the saved language after loading (no flash of a wrong default)", async () => {
    mockMe = { app_language: "ko" };
    api.language.mockResolvedValue({ app_language: "ko" });
    renderScreen("ko");
    // Seeded from the auth cache → correct card selected immediately.
    expect(card("한국어")).toHaveAttribute("aria-checked", "true");
    expect(card("English")).toHaveAttribute("aria-checked", "false");
    // Screen chrome is localized to the persisted language.
    expect(screen.getByRole("heading", { name: "언어 설정" })).toBeInTheDocument();
  });

  it("re-checks the server and shows its value over a stale cached one", async () => {
    // The profile cache still says 한국어; the account is English now.
    mockMe = { app_language: "ko" };
    api.language.mockResolvedValue({ app_language: "en" });
    renderScreen("en");
    await waitFor(() => expect(card("English")).toHaveAttribute("aria-checked", "true"));
    expect(card("한국어")).toHaveAttribute("aria-checked", "false");
    expect(api.language).toHaveBeenCalled();
  });

  it("never lets a late server value override a card the user tapped", async () => {
    let resolve: (v: { app_language: string }) => void = () => {};
    api.language.mockReturnValue(new Promise((r) => (resolve = r)));
    renderScreen();
    await userEvent.click(card("한국어"));
    resolve({ app_language: "en" });
    await waitFor(() => expect(api.language).toHaveBeenCalled());
    expect(card("한국어")).toHaveAttribute("aria-checked", "true");
  });

  it("English selected uses the selected style; exactly one is selected", async () => {
    renderScreen();
    await screen.findByText("English");
    expect(card("English").className).toContain("is-selected");
    expect(card("한국어").className).not.toContain("is-selected");
  });

  it("tapping a card updates only the pending selection (no API call, no global change)", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    expect(card("한국어")).toHaveAttribute("aria-checked", "true");
    expect(card("English")).toHaveAttribute("aria-checked", "false");
    expect(api.setLanguage).not.toHaveBeenCalled(); // not applied until Save
    expect(setMe).not.toHaveBeenCalled();
  });

  it("Save calls the update API with the selected code (ko)", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledWith("ko"));
  });

  it("Save calls the update API with en when English is chosen", async () => {
    mockMe = { app_language: "ko" };
    api.language.mockResolvedValue({ app_language: "ko" });
    api.setLanguage.mockResolvedValue({ app_language: "en" });
    renderScreen("ko");
    await userEvent.click(card("English"));
    await userEvent.click(screen.getByRole("button", { name: "언어 설정 저장" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledWith("en"));
  });

  it("prevents duplicate save submissions and shows a loading state", async () => {
    let resolve!: (v: unknown) => void;
    api.setLanguage.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderScreen();
    await userEvent.click(card("한국어"));
    const saveBtn = screen.getByRole("button", { name: "Save language setting" });
    await userEvent.click(saveBtn);
    await userEvent.click(saveBtn); // ignored while pending
    expect(api.setLanguage).toHaveBeenCalledTimes(1);
    expect(saveBtn).toBeDisabled(); // loading state
    resolve({ app_language: "ko" });
  });

  it("successful save updates the auth cache and shows the success modal with exact copy", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(setMe).toHaveBeenCalledWith(expect.objectContaining({ app_language: "ko" })));
    // Success modal appears (localized to the newly applied language, ko).
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("언어 설정이 저장됐습니다")).toBeInTheDocument();
    expect(within(dialog).getByText("이제부터 선택하신 언어로 이용하실 수 있어요")).toBeInTheDocument();
    // Does not navigate until the user confirms.
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
  });

  it("확인 on the success modal closes it and returns to the previous screen (no re-save)", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.setLanguage).toHaveBeenCalledTimes(1); // 확인 must not save again
  });

  it("failed save preserves the pending selection, keeps the screen, and allows retry", async () => {
    api.setLanguage.mockRejectedValueOnce(new Error("boom"));
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledTimes(1));
    // Stayed on the screen, pending kept, global not changed, no success modal.
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(card("한국어")).toHaveAttribute("aria-checked", "true");
    expect(setMe).not.toHaveBeenCalled();
    // Retry works.
    api.setLanguage.mockResolvedValueOnce({ app_language: "ko" });
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledTimes(2));
  });

  it("clamps an unsupported backend value to the default (en)", async () => {
    mockMe = { app_language: "fr" };
    api.language.mockResolvedValue({ app_language: "fr" });
    renderScreen();
    await screen.findByText("English");
    expect(card("English")).toHaveAttribute("aria-checked", "true");
  });

  /* --------------------------- unsaved-change guard --------------------- */

  it("leaves immediately (no modal) when nothing was changed", async () => {
    renderScreen();
    await screen.findByText("English");
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });

  it("goes back via in-app SPA navigation (renders the parent route, not a reload)", async () => {
    renderScreen();
    await screen.findByText("English");
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    // Rendered the parent route in-place (SPA) rather than reloading this one.
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Language" })).not.toBeInTheDocument();
  });

  it("shows the confirmation modal with the exact copy when leaving with an unsaved change", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    // The screen renders in English here, so the shared modal does too.
    expect(screen.getByText("Leave without saving your changes?")).toBeInTheDocument();
    expect(screen.getByText("Your changes will not be applied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep editing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
    expect(api.setLanguage).not.toHaveBeenCalled(); // 나가기 must not save
  });

  it("계속하기 closes the modal and keeps the pending selection", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(modal()).not.toBeInTheDocument());
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
    expect(card("한국어")).toHaveAttribute("aria-checked", "true"); // edit preserved
    expect(api.setLanguage).not.toHaveBeenCalled();
  });

  it("나가기 discards the change and completes the navigation (no save)", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(api.setLanguage).not.toHaveBeenCalled();
    expect(setMe).not.toHaveBeenCalled();
  });

  it("reverting the selection back to the original clears the dirty state (no modal)", async () => {
    renderScreen();
    await userEvent.click(card("한국어")); // en → ko (dirty)
    await userEvent.click(card("English")); // back to the original en
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });

  it("a successful save clears the dirty state — the unsaved-changes guard never fires", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    // Success dialog shows; the unsaved-changes guard (alertdialog) must NOT.
    const dialog = await screen.findByRole("dialog");
    expect(modal()).not.toBeInTheDocument();
    // 확인 returns to the previous screen without the guard intercepting.
    await userEvent.click(within(dialog).getByRole("button", { name: "확인" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });
});
