import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { resetTimezoneSync, syncDeviceTimezone } from "../lib/timezoneSync";

/** How often a visible app re-reads the device zone (a string compare; a
 * request is only sent when it changed, e.g. mid-flight with the app open). */
const RECHECK_MS = 60_000;

/**
 * Keeps the server on the device's timezone while signed in: syncs on sign-in,
 * whenever the app returns to the foreground, and on a light timer. When the
 * server's zone actually changes, every cached query is refreshed, since
 * "today" — goals, streak, attendance, calendars — may now be a different day.
 */
export function useDeviceTimezoneSync(): void {
  const { status } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (status !== "signed-in") {
      resetTimezoneSync();
      return;
    }
    let cancelled = false;
    const sync = () => {
      void syncDeviceTimezone().then((changed) => {
        if (changed && !cancelled) void qc.invalidateQueries();
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    sync();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", sync);
    const timer = window.setInterval(sync, RECHECK_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", sync);
      window.clearInterval(timer);
    };
  }, [status, qc]);
}
