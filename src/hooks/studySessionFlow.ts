import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { learnApi, studyApi } from "../api/endpoints";
import { errorMessage } from "../lib/http";
import { isOpenActivity, visibleActivities } from "../lib/studySession";
import { randomUuid } from "../lib/uuid";
import type { StudySession } from "../lib/types";
import { useToast } from "./toast";
import { useDashboard } from "../api/queries";

/**
 * The pieces the two daily study screens (conversation, TOPIK) share: today's
 * goal, starting the adaptive session, bookmarks, and the single exit path.
 */

/** The most activities one adaptive session plans (server limit). */
export const MAX_SESSION_ACTIVITIES = 20;

/** The adaptive session behind a set: its id and the plan revision a
 * customization is made against. */
export type StudyRef = { sessionId: string; revision: number };

export type DailyTrack = "conversation" | "topik";

/** Today's goal on one track, from the dashboard (server-derived). */
export function useTrackGoal(category: DailyTrack) {
  const q = useDashboard();
  const track = q.data?.tracks.find((x) => x.category === category);
  return {
    track,
    level: track?.level ?? 1,
    /** Items left to satisfy today's goal. */
    remaining: track ? Math.max(track.goal.target - track.goal.current, 0) : 0,
    /** The dashboard has settled (a failed one too — the set is then sized
     * by the server's default), so the screen never waits on it forever. */
    ready: q.isFetched,
  };
}

type StartBody = Omit<Parameters<typeof studyApi.start>[0], "client_request_id" | "activity_count">;

/**
 * Start the adaptive session — or resume the active one with the same scope —
 * for `count` items (capped at the server limit; none = the server default).
 * A resumed session with nothing left open is finished and a fresh one started.
 */
export async function startStudySession(body: StartBody, count: number | undefined): Promise<StudySession> {
  const full = { ...body, ...(count ? { activity_count: Math.min(count, MAX_SESSION_ACTIVITIES) } : {}) };
  let s = await studyApi.start({ ...full, client_request_id: randomUuid() });
  if (!visibleActivities(s).some(isOpenActivity)) {
    await studyApi.complete(s.session_id).catch(() => studyApi.abandon(s.session_id));
    s = await studyApi.start({ ...full, client_request_id: randomUuid() });
  }
  return s;
}

/** Record that the current activity is on screen (exposure for the
 * repetition policy). Idempotent server-side. */
export function usePresentActivity(study: StudyRef | null, activityId: string | null) {
  useEffect(() => {
    if (study && activityId) void studyApi.present(study.sessionId, activityId).catch(() => undefined);
  }, [study, activityId]);
}

/** Optimistic bookmark toggles keyed by item id, rolled back on failure. */
export function useBookmarks(api: { bookmark: (id: string) => Promise<unknown>; unbookmark: (id: string) => Promise<unknown> }) {
  const toast = useToast();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  async function toggle(id: string) {
    const on = saved[id];
    setSaved((m) => ({ ...m, [id]: !on }));
    try {
      if (on) await api.unbookmark(id);
      else await api.bookmark(id);
    } catch (e) {
      setSaved((m) => ({ ...m, [id]: on }));
      toast.error(errorMessage(e));
    }
  }
  return { saved, setSaved, toggle };
}

/**
 * The single exit path for 완료 (the summary modal) and the back chevron.
 * Leaving ends the session: its snapshot is dropped so re-entry starts fresh,
 * and the adaptive session is completed (or abandoned when ended early). A
 * session with any attempt records its study time on the server, which also
 * creates the points notification. Finishing never changes a level — levels
 * come only from the server's proficiency assessments. Single-flight, so
 * repeated taps never double-record.
 */
export function useExitSession(category: DailyTrack, clearSnapshot: () => void) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const finalizingRef = useRef(false);
  return async function exitSession({
    study,
    attempted,
    startedAt,
  }: {
    study: StudyRef | null;
    attempted: boolean;
    startedAt: number;
  }) {
    if (finalizingRef.current) return;
    // Before either path: a double tap must not complete twice or go back twice.
    finalizingRef.current = true;
    clearSnapshot();
    if (study) {
      const id = study.sessionId;
      void studyApi.complete(id).catch(() => studyApi.abandon(id).catch(() => undefined));
    }
    if (!attempted) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav(-1);
      return;
    }
    const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    try {
      await learnApi.recordSession({ session_type: "sentence", category, duration_seconds });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      qc.invalidateQueries({ queryKey: ["management"] });
    } catch {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    nav(-1);
  };
}
