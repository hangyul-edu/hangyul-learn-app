import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/prev", "/settings/language"]} initialIndex={1}>
        <ToastProvider>
          <Routes>
            <Route path="/prev" element={<div>PREV_SCREEN</div>} />
            <Route path="/settings/language" element={<LanguageSettings />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const card = (label: string) => screen.getByRole("radio", { name: new RegExp(label) });

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
    expect(await screen.findByText("PREV_SCREEN")).toBeInTheDocument();
  });

  it("failed save preserves the pending selection, keeps the screen, and allows retry", async () => {
    api.setLanguage.mockRejectedValueOnce(new Error("boom"));
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Save language setting" }));
    await waitFor(() => expect(api.setLanguage).toHaveBeenCalledTimes(1));
    // Stayed on the screen, pending kept, global not changed.
    expect(screen.queryByText("PREV_SCREEN")).not.toBeInTheDocument();
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

  it("back button discards the pending selection without calling the API", async () => {
    renderScreen();
    await userEvent.click(card("한국어"));
    await userEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(await screen.findByText("PREV_SCREEN")).toBeInTheDocument();
    expect(api.setLanguage).not.toHaveBeenCalled();
    expect(setMe).not.toHaveBeenCalled();
  });
});
