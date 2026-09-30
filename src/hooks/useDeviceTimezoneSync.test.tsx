import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { syncDeviceTimezone, resetTimezoneSync } = vi.hoisted(() => ({
  syncDeviceTimezone: vi.fn(async () => false),
  resetTimezoneSync: vi.fn(),
}));
vi.mock("../lib/timezoneSync", () => ({ syncDeviceTimezone, resetTimezoneSync }));

let status = "signed-in";
vi.mock("./auth", () => ({ useAuth: () => ({ status }) }));

import { useDeviceTimezoneSync } from "./useDeviceTimezoneSync";

function mount(qc = new QueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDeviceTimezoneSync(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  status = "signed-in";
});

describe("useDeviceTimezoneSync", () => {
  it("syncs on sign-in and again when the app returns to the foreground", async () => {
    mount();
    await waitFor(() => expect(syncDeviceTimezone).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(syncDeviceTimezone).toHaveBeenCalledTimes(2));
  });

  it("refreshes every cached query when the server's zone changed", async () => {
    syncDeviceTimezone.mockResolvedValueOnce(true);
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    mount(qc);

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  });

  it("leaves the cache alone when nothing changed", async () => {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");

    mount(qc);
    await waitFor(() => expect(syncDeviceTimezone).toHaveBeenCalled());

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("does not sync while signed out, and forgets the last sync", () => {
    status = "signed-out";
    mount();
    expect(syncDeviceTimezone).not.toHaveBeenCalled();
    expect(resetTimezoneSync).toHaveBeenCalled();
  });
});
