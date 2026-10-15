import { useEffect, useRef, useState } from "react";
import { learnApi } from "../../api/endpoints";
import { ApiError } from "../../lib/http";

/** At most this many fresh playback URLs per window before giving up on the stream. */
const STREAM_REFRESH_LIMIT = 3;
const STREAM_REFRESH_WINDOW_MS = 5 * 60 * 1000;

/** Where to pick up after the signed URL was swapped for a fresh one. */
export type StreamReload = { at: number; play: boolean };

/**
 * The lecture's playback URL: requested once per visit after the fresh read
 * (`ready`) — a later refetch (window focus) must not swap the URL and restart
 * the video mid-play — with the premium gate on a 402 and a retryable failure
 * otherwise, instead of a black stage forever. A stream that stops mid-watch
 * (its signed URL ran out) gets a fresh URL and carries on from the same
 * second; one that keeps failing is not retried forever (`onTrouble` brings
 * the controls up instead).
 */
export function useLectureStream({
  lectureId,
  ready,
  position,
  onTrouble,
}: {
  lectureId: string;
  ready: boolean;
  /** The second and playing state to resume after a swap. */
  position: () => StreamReload;
  onTrouble: () => void;
}) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [premiumLocked, setPremiumLocked] = useState(false);
  const [playFailed, setPlayFailed] = useState(false);
  const reloadRef = useRef<StreamReload | null>(null);
  const refreshTimesRef = useRef<number[]>([]);
  const playRequestedRef = useRef(false);

  function requestPlay() {
    playRequestedRef.current = true;
    setPlayFailed(false);
    learnApi
      .lecturePlay(lectureId)
      .then((r) => setVideoUrl(r.video.url))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 402) setPremiumLocked(true);
        else setPlayFailed(true);
      });
  }
  useEffect(() => {
    if (!ready || playRequestedRef.current) return;
    requestPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function refreshStream() {
    const now = Date.now();
    const recent = refreshTimesRef.current.filter((t) => now - t < STREAM_REFRESH_WINDOW_MS);
    if (recent.length >= STREAM_REFRESH_LIMIT) {
      refreshTimesRef.current = recent;
      onTrouble();
      return;
    }
    refreshTimesRef.current = [...recent, now];
    reloadRef.current = position();
    learnApi
      .lectureVideo(lectureId)
      .then((r) => setVideoUrl(r.video_url))
      .catch((e) => {
        reloadRef.current = null;
        if (e instanceof ApiError && e.status === 402) {
          setPremiumLocked(true);
          setVideoUrl(null);
        }
        onTrouble();
      });
  }

  /** The pending resume point after a swap, consumed by the new stream. */
  function takeReload(): StreamReload | null {
    const reload = reloadRef.current;
    reloadRef.current = null;
    return reload;
  }

  return { videoUrl, premiumLocked, playFailed, requestPlay, refreshStream, takeReload };
}
