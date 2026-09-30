import { userApi } from "../api/endpoints";
import { deviceTimeZone } from "./timezone";

/**
 * Keeps the server told which timezone the device is in.
 *
 * The server counts every daily boundary (attendance, streak, goals, the daily
 * question set, allowances, reminders, quiet hours) in the zone it was last
 * sent, so the app syncs on sign-in and whenever the device's zone may have
 * changed (see `useDeviceTimezoneSync`). A zone already synced this session is
 * not sent again, and concurrent callers share one request.
 */

let syncedZone: string | null = null;
let inFlight: Promise<boolean> | null = null;

/**
 * Sync the device's current zone if it differs from the last one synced.
 * Resolves to whether the server's zone changed. Never rejects: a failed sync
 * is retried on the next call, and nothing the caller does must wait on it.
 */
export function syncDeviceTimezone(): Promise<boolean> {
  const zone = deviceTimeZone();
  if (zone === syncedZone) return Promise.resolve(false);
  if (inFlight) return inFlight;
  // Started inside the chain so even a synchronous throw resolves to false.
  inFlight = Promise.resolve()
    .then(() => userApi.syncTimezone(zone))
    .then((res) => {
      syncedZone = zone;
      return res.changed;
    })
    .catch(() => false)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Forget what was synced — on sign-out, so the next account syncs too. */
export function resetTimezoneSync(): void {
  syncedZone = null;
  inFlight = null;
}
