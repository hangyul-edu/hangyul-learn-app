import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";

vi.mock("../api/endpoints", () => ({
  notifApi: { settings: vi.fn(), updateSettings: vi.fn() },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

import { notifApi } from "../api/endpoints";
import { Settings } from "./Settings";

const api = notifApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

// A full settings object — the PUT echoes back what it receives.
const settings = (over: Record<string, unknown> = {}) => ({
  push_enabled: true,
  email_enabled: true,
  learning_reminder: true,
  friend_alerts: true,
  league_alerts: true,
  service_notifications: true,
  marketing: false,
  ...over,
});

function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    // Assertions below are written against the Korean design frames.
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>
            <Settings />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.settings.mockResolvedValue(settings());
  api.updateSettings.mockImplementation(async (body: Record<string, unknown>) => body);
});

describe("Notification Settings (알림 설정)", () => {
  it("renders the header and exactly two push rows from saved server values", async () => {
    renderSettings();
    expect(await screen.findByRole("heading", { name: "알림 설정" })).toBeInTheDocument();
    const service = await screen.findByRole("switch", { name: "서비스 알림" });
    const marketing = screen.getByRole("switch", { name: "광고성 알림" });
    expect(service).toHaveAttribute("aria-checked", "true");
    expect(marketing).toHaveAttribute("aria-checked", "false");
    // Only these two switches — no theme / learning / granular toggles.
    expect(screen.getAllByRole("switch")).toHaveLength(2);
  });

  it("does not flash default values before the settings load", async () => {
    let resolve!: (v: unknown) => void;
    api.settings.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderSettings();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    resolve(settings());
    expect(await screen.findByRole("switch", { name: "서비스 알림" })).toBeInTheDocument();
  });

  it("toggles Service independently (marketing untouched)", async () => {
    renderSettings();
    await userEvent.click(await screen.findByRole("switch", { name: "서비스 알림" }));
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(1));
    const body = api.updateSettings.mock.calls[0][0];
    expect(body.service_notifications).toBe(false);
    expect(body.marketing).toBe(false); // unchanged
  });

  it("toggles Marketing independently (service untouched)", async () => {
    renderSettings();
    await userEvent.click(await screen.findByRole("switch", { name: "광고성 알림" }));
    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(1));
    const body = api.updateSettings.mock.calls[0][0];
    expect(body.marketing).toBe(true);
    expect(body.service_notifications).toBe(true); // unchanged
  });

  it("rolls the switch back and shows an error when the update fails", async () => {
    api.updateSettings.mockRejectedValue(new Error("boom"));
    renderSettings();
    const service = await screen.findByRole("switch", { name: "서비스 알림" });
    expect(service).toHaveAttribute("aria-checked", "true");
    await userEvent.click(service);
    // Reverts to the server value and surfaces the error.
    await waitFor(() => expect(screen.getByRole("switch", { name: "서비스 알림" })).toHaveAttribute("aria-checked", "true"));
    expect(await screen.findByText("설정을 변경하지 못했어요.")).toBeInTheDocument();
  });

  it("offers a retry when the saved settings cannot be loaded", async () => {
    // Regression: a failed load rendered an empty page with no error or retry.
    api.settings.mockRejectedValueOnce(new Error("boom"));
    renderSettings();
    await userEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("switch", { name: "서비스 알림" })).toBeInTheDocument();
    expect(api.settings).toHaveBeenCalledTimes(2);
  });

  it("ignores rapid repeat taps on the same switch (one request)", async () => {
    let resolve!: () => void;
    api.updateSettings.mockReturnValue(new Promise((r) => { resolve = () => r(settings({ service_notifications: false })); }));
    renderSettings();
    const service = await screen.findByRole("switch", { name: "서비스 알림" });
    await userEvent.click(service);
    await userEvent.click(service); // ignored (pending)
    expect(api.updateSettings).toHaveBeenCalledTimes(1);
    expect(service).toBeDisabled();
    resolve();
  });
});
