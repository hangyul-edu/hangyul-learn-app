/**
 * The app shows the signed-in account's language — the one Language Settings
 * has selected. The bug: the device's stored language always won, so after
 * signing out and in the app could be in English while the settings page had
 * 한국어 selected.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { I18nProvider, useI18n } from "../i18n";
import { LANGUAGE_STORAGE_KEY } from "../lib/language";
import type { Me } from "../lib/types";

const auth = vi.hoisted(() => ({ me: null as Partial<Me> | null, setMe: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => auth }));
vi.mock("../api/endpoints", () => ({ settingsApi: { setLanguage: vi.fn() } }));

import { settingsApi } from "../api/endpoints";
import { useAccountLanguage } from "./useAccountLanguage";

const setLanguageApi = settingsApi.setLanguage as unknown as ReturnType<typeof vi.fn>;

let rerenderWith: (me: Partial<Me> | null) => void = () => {};

function Harness() {
  const [, force] = useState(0);
  rerenderWith = (me) => {
    auth.me = me;
    force((n) => n + 1);
  };
  useAccountLanguage();
  return <span data-testid="lang">{useI18n().language}</span>;
}

function renderWith(device: "en" | "ko", me: Partial<Me> | null) {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, device);
  auth.me = me;
  render(
    <I18nProvider>
      <Harness />
    </I18nProvider>,
  );
}

const member = (app_language: string): Partial<Me> => ({ user_id: "u1", nickname: "ana", app_language });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.me = null;
});

describe("useAccountLanguage", () => {
  it("shows the account's language even when the device stored another", async () => {
    renderWith("en", member("ko"));
    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("ko"));
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ko");
    expect(setLanguageApi).not.toHaveBeenCalled();
  });

  it("follows the account after signing out and in as someone else", async () => {
    renderWith("ko", member("ko"));
    expect(screen.getByTestId("lang")).toHaveTextContent("ko");
    act(() => rerenderWith(null)); // signed out: the device keeps the last language
    expect(screen.getByTestId("lang")).toHaveTextContent("ko");
    act(() => rerenderWith({ user_id: "u2", nickname: "ben", app_language: "en" }));
    await waitFor(() => expect(screen.getByTestId("lang")).toHaveTextContent("en"));
  });

  it("does nothing while signed out", () => {
    renderWith("ko", null);
    expect(screen.getByTestId("lang")).toHaveTextContent("ko");
  });

  it("saves the language picked on this device to a brand-new account", async () => {
    setLanguageApi.mockResolvedValue({ app_language: "ko" });
    renderWith("ko", { user_id: "u3", nickname: null, app_language: "en" });
    await waitFor(() => expect(setLanguageApi).toHaveBeenCalledWith("ko"));
    expect(screen.getByTestId("lang")).toHaveTextContent("ko"); // no flip to the server default
    await waitFor(() => expect(auth.setMe).toHaveBeenCalled());
    const update = auth.setMe.mock.calls[0][0] as (prev: Partial<Me>) => Partial<Me>;
    expect(update({ user_id: "u3", app_language: "en" }).app_language).toBe("ko");
  });

  it("does not resend the save on every render", async () => {
    setLanguageApi.mockReturnValue(new Promise(() => {}));
    renderWith("ko", { user_id: "u3", nickname: null, app_language: "en" });
    act(() => rerenderWith({ ...auth.me! }));
    act(() => rerenderWith({ ...auth.me! }));
    await waitFor(() => expect(setLanguageApi).toHaveBeenCalledTimes(1));
  });
});
