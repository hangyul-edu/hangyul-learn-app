import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { learnApi } from "../api/endpoints";
import { localDay } from "../lib/timezone";
import type { DashboardSummary } from "../lib/types";

type Activity = "conversation" | "topik" | "lecture";

/**
 * Returns a stable `mark(activityType, contentId?)` to call the moment a
 * qualifying learning item actually becomes the active on-screen thing.
 *
 * Callers: `Lecture.tsx` on playback start, and — through
 * `useRecordDisplayedItem` — every screen that displays a Conversation
 * sentence or a TOPIK question. Displaying the item is enough: the server
 * counts the day for both the streak and Total Learning Days without an
 * answer (answers still feed the per-category counts and the goal through
 * their own endpoints).
 *
 * It optimistically lights the sun everywhere by patching the shared
 * ["dashboard"] cache, then records the activity on the server. The record is
 * idempotent per day (the member's local day, in the device timezone), so this
 * fires the network call at most once per mount per local day — later items,
 * re-renders and StrictMode re-runs are
 * no-ops. Failures are silent (studying is never blocked); a failed call
 * re-arms so the next item retries, and reconciles the sun with the server
 * (invalidate) so it never lies about persisted state.
 */
export function useMarkStudied() {
  const qc = useQueryClient();
  // The local day this mount has already recorded (or is recording), if any.
  const firedDayRef = useRef<string | null>(null);
  return useCallback(
    (activityType: Activity, contentId?: string) => {
      const day = localDay();
      if (firedDayRef.current === day) return;
      firedDayRef.current = day;
      qc.setQueryData<DashboardSummary>(["dashboard"], (prev) =>
        prev ? { ...prev, studied_today: true } : prev,
      );
      // Issued inside the chain so even a synchronous throw lands in `catch`:
      // recording must never break the screen that displays the item.
      Promise.resolve()
        .then(() => learnApi.recordActivity(activityType, contentId))
        .then(() => qc.invalidateQueries({ queryKey: ["dashboard"] }))
        .catch(() => {
          // Let a later item retry, and re-sync the sun with server truth.
          if (firedDayRef.current === day) firedDayRef.current = null;
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        });
    },
    [qc],
  );
}

/**
 * Records study activity when a Conversation sentence or TOPIK question is
 * displayed. Pass the id of the item currently on screen, or null/undefined
 * while nothing is shown (loading, a list, a result screen) — nothing is sent
 * then. Re-renders with the same item never re-send; a new item only sends
 * when the per-day record has not been made yet (see `useMarkStudied`).
 */
export function useRecordDisplayedItem(
  activityType: Exclude<Activity, "lecture">,
  contentId: string | null | undefined,
) {
  const mark = useMarkStudied();
  useEffect(() => {
    if (contentId) mark(activityType, contentId);
  }, [mark, activityType, contentId]);
}
