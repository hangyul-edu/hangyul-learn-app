import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { syncTimezone } = vi.hoisted(() => ({
  syncTimezone: vi.fn(async (timezone: string) => ({
    timezone,
    changed: true,
    today: "2026-09-30",
    resets_at: "2026-09-30T15:00:00Z",
  })),
}));
vi.mock("../api/endpoints", () => ({ userApi: { syncTimezone } }));

import { resetTimezoneSync, syncDeviceTimezone } from "./timezoneSync";

let zone = "Asia/Seoul";

beforeEach(() => {
  vi.clearAllMocks();
  resetTimezoneSync();
  zone = "Asia/Seoul";
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone: zone }) }) as unknown as Intl.DateTimeFormat,
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("syncDeviceTimezone", () => {
  it("sends the device's IANA zone once, then not again while it is unchanged", async () => {
    expect(await syncDeviceTimezone()).toBe(true);
    expect(await syncDeviceTimezone()).toBe(false);
    expect(syncTimezone).toHaveBeenCalledTimes(1);
    expect(syncTimezone).toHaveBeenCalledWith("Asia/Seoul");
  });

  it("shares one request between concurrent callers", async () => {
    await Promise.all([syncDeviceTimezone(), syncDeviceTimezone(), syncDeviceTimezone()]);
    expect(syncTimezone).toHaveBeenCalledTimes(1);
  });

  it("syncs again when the device moves to another zone (travel)", async () => {
    await syncDeviceTimezone();
    zone = "America/Los_Angeles";
    await syncDeviceTimezone();
    expect(syncTimezone).toHaveBeenLastCalledWith("America/Los_Angeles");
    expect(syncTimezone).toHaveBeenCalledTimes(2);
  });

  it("never rejects, and retries a failed sync on the next call", async () => {
    syncTimezone.mockRejectedValueOnce(new Error("offline"));
    expect(await syncDeviceTimezone()).toBe(false);
    expect(await syncDeviceTimezone()).toBe(true);
    expect(syncTimezone).toHaveBeenCalledTimes(2);
  });

  it("syncs again for the next account after a reset", async () => {
    await syncDeviceTimezone();
    resetTimezoneSync();
    await syncDeviceTimezone();
    expect(syncTimezone).toHaveBeenCalledTimes(2);
  });

  it("still syncs the next account when a reset lands mid-request", async () => {
    // Regression: the first account's request resolved after the sign-out and
    // marked the zone synced, so the next account's sync was skipped.
    let finish!: () => void;
    syncTimezone.mockImplementationOnce(
      (timezone: string) =>
        new Promise((resolve) => {
          finish = () => resolve({ timezone, changed: true, today: "2026-09-30", resets_at: "2026-09-30T15:00:00Z" });
        }),
    );
    const first = syncDeviceTimezone();
    await vi.waitFor(() => expect(syncTimezone).toHaveBeenCalledTimes(1));
    resetTimezoneSync();
    finish();
    await first;

    expect(await syncDeviceTimezone()).toBe(true);
    expect(syncTimezone).toHaveBeenCalledTimes(2);
  });
});
