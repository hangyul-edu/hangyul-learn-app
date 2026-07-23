import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { gameApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { normalizeLanguage } from "../lib/language";
import { AttendanceModal } from "./AttendanceModal";
import type { AttendanceCheckIn } from "../lib/types";

interface AttendanceModalData {
  pointsAwarded: number;
  streakDays: number;
  attendanceDate: string;
}

/** A well-formed check-in response has the fields the modal depends on. Anything
 * missing/mistyped is treated as malformed — we never fabricate attendance. */
function isValidResponse(r: AttendanceCheckIn | undefined | null): r is AttendanceCheckIn {
  return (
    !!r &&
    typeof r.checked_in_today === "boolean" &&
    typeof r.points_awarded === "number" &&
    typeof r.consecutive_days === "number" &&
    typeof r.last_checkin_date === "string"
  );
}

/**
 * Drives the daily attendance flow. Mounted once at the app root (inside the
 * auth + query providers). When a signed-in session is established (cold-start
 * auto-login or a fresh login), it calls the attendance API once and shows the
 * completion modal ONLY for a newly-recorded check-in that awarded points. The
 * server is the source of truth; all modal values come from its response.
 *
 * Guards against duplicate requests, React Strict Mode double-execution, route
 * remounts, and reprocessing the same response.
 */
export function AttendanceGate() {
  const { status, me } = useAuth();
  const qc = useQueryClient();
  const lang = normalizeLanguage(me?.app_language);
  const [data, setData] = useState<AttendanceModalData | null>(null);

  // Attendance must only be recorded once the user has finished onboarding — not
  // while they are still setting up their profile or answering the onboarding
  // questions. `onboarding_completed` (from /users/me) is the source of truth.
  // (Refreshing `me` after onboarding flips this true, so the day they finish
  // still counts — see Onboarding.submit.)
  const onboardingComplete = status === "signed-in" && !!me && me.onboarding_completed;

  const firedRef = useRef(false); // one request per signed-in session
  const inFlightRef = useRef(false); // no concurrent requests
  const processedDateRef = useRef<string | null>(null); // don't reprocess a date

  useEffect(() => {
    if (status !== "signed-in") {
      // Reset so the next sign-in checks in again (e.g. after re-login).
      firedRef.current = false;
      inFlightRef.current = false;
      return;
    }
    if (!onboardingComplete) return; // wait until onboarding is fully complete
    if (firedRef.current || inFlightRef.current) return;
    firedRef.current = true;
    inFlightRef.current = true;
    (async () => {
      try {
        const res = await gameApi.checkIn();
        if (!isValidResponse(res)) {
          // Malformed: never show the modal or imply success.
          // eslint-disable-next-line no-console
          console.error("[attendance] malformed check-in response", res);
          return;
        }
        // Show only for a *newly* recorded check-in that awarded points — never
        // for a duplicate same-day check (checked_in_today === true) or 0 points.
        const isNewlyRecorded = res.checked_in_today === false && res.points_awarded > 0;
        if (isNewlyRecorded && processedDateRef.current !== res.last_checkin_date) {
          processedDateRef.current = res.last_checkin_date;
          setData({
            pointsAwarded: res.points_awarded,
            streakDays: res.consecutive_days,
            attendanceDate: res.last_checkin_date,
          });
          // Refresh points/streak/league/notification views so the award shows.
          for (const key of [
            ["dashboard"],
            ["streak"],
            ["points"],
            ["league-me"],
            ["league-season"],
            ["league-rankings"],
            ["notif-unread"],
          ]) {
            qc.invalidateQueries({ queryKey: key });
          }
        }
      } catch {
        /* non-critical — attendance retries on the next app open */
      } finally {
        inFlightRef.current = false;
      }
    })();
  }, [status, onboardingComplete, qc]);

  if (!data) return null;
  return (
    <AttendanceModal
      pointsAwarded={data.pointsAwarded}
      streakDays={data.streakDays}
      lang={lang}
      onClose={() => setData(null)}
    />
  );
}
