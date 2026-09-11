import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { learnApi } from "../api/endpoints";
import type { DashboardSummary } from "../lib/types";

type Activity = "conversation" | "topik" | "lecture";

/**
 * Returns a stable `mark(activityType, contentId?)` to call the moment a
 * qualifying learning item actually becomes the active on-screen thing.
 *
 * **Only `Lecture.tsx` calls this, on playback start.** Conversation and TOPIK
 * light the sun through their own answer endpoints instead — a sentence merely
 * appearing on screen does not count. This comment used to list them as
 * callers, describing an intent that was never wired up; it is the wiring, not
 * this text, that decides, so check the call sites before trusting it again.
 *
 * It optimistically lights the sun everywhere by patching the shared
 * ["dashboard"] cache, then records the activity on the server, which counts
 * the day for both the streak and Total Learning Days. The record is
 * idempotent per local day, and this fires the network call at most once per
 * mount. On failure it reconciles with the server (invalidate) so the sun
 * never lies about persisted state.
 */
export function useMarkStudied() {
  const qc = useQueryClient();
  const firedRef = useRef(false);
  return useCallback(
    (activityType: Activity, contentId?: string) => {
      if (firedRef.current) return;
      firedRef.current = true;
      qc.setQueryData<DashboardSummary>(["dashboard"], (prev) =>
        prev ? { ...prev, studied_today: true } : prev,
      );
      learnApi
        .recordActivity(activityType, contentId)
        .then(() => qc.invalidateQueries({ queryKey: ["dashboard"] }))
        .catch(() => {
          // Let a later view retry, and re-sync the sun with server truth.
          firedRef.current = false;
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        });
    },
    [qc],
  );
}
