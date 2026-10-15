import { learnApi } from "../../api/endpoints";

/**
 * Seconds of playback between progress heartbeats. The server only counts a
 * lecture as watched when its frontier advances in steps of at most 60s, so
 * completion depends on these arriving while the video plays.
 */
export const HEARTBEAT_SECONDS = 15;

/** Navigation state the course page reads to show COU-021's reward. */
export type CourseRewardState = { rewardPoints?: number };

/** Set by the series page when it opens a lesson: the player then returns by
 * stepping back instead of pushing the series page again. */
export type LectureEntryState = { fromSeriesId?: string };

const SERIES_REWARD_KEY = "hangyul.seriesReward:";

// The latest position save per lecture (beat, pause or exit). Reopening the
// lecture waits for it before reading the lecture back, so a quick close and
// reopen can never read the position from before the save landed.
export const pendingSaves = new Map<string, Promise<unknown>>();

/** Every position save still in flight has landed (or failed). Pages that
 * read watch history — the series page's 바로 학습하기 — wait for this, or a
 * lesson just closed would not be the one most recently watched yet. */
export function progressSavesSettled(): Promise<unknown> {
  return Promise.all([...pendingSaves.values()]);
}

/** Send a position save and track it; never rejects. */
export function saveOnExit(lectureId: string, seconds: number) {
  const save = learnApi
    .progress(lectureId, Math.floor(seconds))
    .catch(() => undefined)
    .finally(() => {
      if (pendingSaves.get(lectureId) === save) pendingSaves.delete(lectureId);
    });
  pendingSaves.set(lectureId, save);
}

/** Hand the just-earned points to the series page we are stepping back to
 * (history.back cannot carry router state). */
export function stashSeriesReward(seriesId: string, points: number) {
  try {
    sessionStorage.setItem(SERIES_REWARD_KEY + seriesId, String(points));
  } catch {
    // Storage unavailable: the points are paid anyway; only the modal is lost.
  }
}

/** The points a lesson handed back to this series page, if any. */
export function peekSeriesReward(seriesId: string): number {
  try {
    return Number(sessionStorage.getItem(SERIES_REWARD_KEY + seriesId)) || 0;
  } catch {
    return 0;
  }
}

export function clearSeriesReward(seriesId: string) {
  try {
    sessionStorage.removeItem(SERIES_REWARD_KEY + seriesId);
  } catch {
    // nothing to clear
  }
}
