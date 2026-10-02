import type { CheckpointInteractionType, LectureCheckpoint } from "./types";

/**
 * Which checkpoints the player's "exclude" switch skips.
 *
 * The switch is per lecture track: a conversation lecture's 말하기 제외 skips
 * the speaking modals, a TOPIK lecture's 문제 풀이 제외 skips the question
 * modals. A checkpoint of the other kind still fires.
 */
export function isExcluded(type: CheckpointInteractionType, trackId: string, exclude: boolean): boolean {
  if (!exclude) return false;
  const speaking = type === "speaking_exercise";
  return trackId === "track_topik" ? !speaking : speaking;
}

/**
 * Largest jump between two time updates that still counts as playing through.
 * Browsers fire `timeupdate` every ~250ms, so anything above this is a seek
 * (or the 5-second skip buttons): checkpoints jumped over are not fired.
 */
export const MAX_PLAY_STEP_SECONDS = 1.5;

/**
 * The checkpoint playback just reached, if any.
 *
 * Fires a checkpoint whenever continuous playback crosses its second — from
 * `previous` (exclusive) to `current` (inclusive). Resuming mid-lecture or
 * seeking past a checkpoint does not fire it. Rewinding before a checkpoint
 * and playing through it again fires it again — whether it was answered, or
 * skipped by the exclude switch, the last time: re-watching a stretch means
 * meeting its checkpoints again, and switching the exclude switch off brings
 * them back. Once a modal closes, playback resumes past its second, so the
 * same crossing never fires twice.
 */
export function dueCheckpoint(
  checkpoints: LectureCheckpoint[],
  previous: number,
  current: number,
  skip: (checkpoint: LectureCheckpoint) => boolean,
): LectureCheckpoint | null {
  if (current < previous || current - previous > MAX_PLAY_STEP_SECONDS) return null;
  for (const checkpoint of checkpoints) {
    if (checkpoint.at_second > current) break;
    if (checkpoint.at_second <= previous && !(previous === 0 && checkpoint.at_second === 0)) continue;
    if (skip(checkpoint)) continue;
    return checkpoint;
  }
  return null;
}
