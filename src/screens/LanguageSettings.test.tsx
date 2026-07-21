import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";

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

function renderScreen() {
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
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
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
    expect(await screen.findByRole("heading", { name: "Language Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go back" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent("English");
    expect(radios[1]).toHaveTextContent("한국어");
  });

  it("selects the saved language after loading (no flash of a wrong default)", async () => {
    mockMe = { app_language: "ko" };
    api.language.mockResolvedValue({ app_language: "ko" });
    renderScreen();
    // Seeded from the auth cache → correct card selected immediately.
    expect(card("한국어")).toHaveAttribute("aria-checked", "true");
    expect(card("English")).toHaveAttribute("aria-checked", "false");
    // Screen chrome is localized to the persisted language.
    expect(screen.getByRole("heading", { name: "언어 설정" })).toBeInTheDocument();
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
    renderScreen();
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

  it("successful save updates the auth cache and returns to the previous screen", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(setMe).toHaveBeenCalledWith(expect.objectContaining({ app_language: "ko" })));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
  });

  it("failed save preserves the pending selection, keeps the screen, and allows retry", async () => {
    api.setLanguage.mockRejectedValueOnce(new Error("boom"));
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledTimes(1));
    // Stayed on the screen, pending kept, global not changed.
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
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
    expect(screen.queryByRole("heading", { name: "Language Settings" })).not.toBeInTheDocument();
  });

  it("shows the confirmation modal with the exact copy when leaving with an unsaved change", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("변경사항을 저장하지 않고 나갈까요?")).toBeInTheDocument();
    expect(screen.getByText("변경사항이 적용되지 않습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "계속하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나가기" })).toBeInTheDocument();
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
    expect(api.setLanguage).not.toHaveBeenCalled(); // 나가기 must not save
  });

  it("계속하기 closes the modal and keeps the pending selection", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "계속하기" }));
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
    await userEvent.click(screen.getByRole("button", { name: "나가기" }));
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

  it("no modal after a successful save (dirty state cleared)", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    // Save navigates back itself; the guard must not intercept it.
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });
});
