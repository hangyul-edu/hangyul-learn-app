import { useCallback, useEffect, useRef, useState } from "react";

/** How long playing video keeps its controls up after the last interaction. */
export const CONTROLS_HIDE_MS = 3000;
/** Pointer movement re-arms the timer at most this often (it fires per frame). */
const ACTIVITY_THROTTLE_MS = 250;

/**
 * Video-player controls that float over the picture and get out of the way.
 *
 * - They start shown, and show again whenever playback pauses.
 * - While the video plays they hide after {@link CONTROLS_HIDE_MS} without
 *   interaction; any interaction (`show`, or `nudge` for continuous signals
 *   such as mouse movement) restarts the count.
 * - `held` keeps them up for as long as it is true — the learner is hovering
 *   them, dragging the scrubber, has keyboard focus in them, or a sheet or
 *   dialog of the player (the chatbot, a checkpoint) is open.
 * - `toggle` is the tap on the picture: shown → hidden, hidden → shown.
 */
export function useAutoHideControls({ playing, held }: { playing: boolean; held: boolean }) {
  const [visible, setVisible] = useState(true);
  // Bumped on every interaction so the hide timer starts over.
  const [activity, setActivity] = useState(0);
  const lastNudge = useRef(0);

  const show = useCallback(() => {
    setVisible(true);
    setActivity((n) => n + 1);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => {
    setVisible((shown) => !shown);
    setActivity((n) => n + 1);
  }, []);
  const nudge = useCallback(() => {
    const now = Date.now();
    if (now - lastNudge.current < ACTIVITY_THROTTLE_MS) return;
    lastNudge.current = now;
    show();
  }, [show]);

  // Paused video, or anything holding the controls, brings them back.
  useEffect(() => {
    if (!playing || held) setVisible(true);
  }, [playing, held]);

  useEffect(() => {
    if (!visible || !playing || held) return;
    const timer = setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [visible, playing, held, activity]);

  return { visible, show, hide, toggle, nudge };
}
