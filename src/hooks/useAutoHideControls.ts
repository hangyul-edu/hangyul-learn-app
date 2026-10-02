import { useCallback, useEffect, useState } from "react";

/** How long playing video keeps its controls up after the last interaction. */
export const CONTROLS_HIDE_MS = 3000;

/**
 * Video-player controls that float over the picture and stay out of the way.
 *
 * - They start hidden: the video opens playing, picture only.
 * - They appear when the learner asks for them — `toggle` is the tap or click
 *   on the picture (shown → hidden, hidden → shown); `show` is for the
 *   player's own reasons (e.g. the browser refused to autoplay, so the play
 *   button must be reachable).
 * - Once shown, while the video plays they hide again after
 *   {@link CONTROLS_HIDE_MS} without interaction; `show` restarts the count.
 *   While paused they stay until tapped away.
 * - `held` keeps them up for as long as it is true — the learner is hovering
 *   them, dragging the scrubber, has keyboard focus in them, or a sheet or
 *   dialog of the player is open. It never brings hidden controls back.
 */
export function useAutoHideControls({ playing, held }: { playing: boolean; held: boolean }) {
  const [visible, setVisible] = useState(false);
  // Bumped on every interaction so the hide timer starts over.
  const [activity, setActivity] = useState(0);

  const show = useCallback(() => {
    setVisible(true);
    setActivity((n) => n + 1);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => {
    setVisible((shown) => !shown);
    setActivity((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!visible || !playing || held) return;
    const timer = setTimeout(() => setVisible(false), CONTROLS_HIDE_MS);
    return () => clearTimeout(timer);
  }, [visible, playing, held, activity]);

  return { visible, show, hide, toggle };
}
