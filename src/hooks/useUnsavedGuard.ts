import { useCallback, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Hold every in-app exit (header back, browser/hardware back, swipe-back, a
 * programmatic pop) while `dirty`, through the data router; the screen shows
 * UnsavedChangesModal while `blocked`. A deliberate exit — a successful save,
 * or 나가기 — is let through.
 */
export function useUnsavedGuard(dirty: boolean) {
  const leavingRef = useRef(false);
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        dirty && !leavingRef.current && currentLocation.pathname !== nextLocation.pathname,
      [dirty],
    ),
  );
  return {
    blocked: blocker.state === "blocked",
    /** A deliberate exit is next (e.g. saved): don't trip the guard. */
    allowLeave: () => {
      leavingRef.current = true;
    },
    /** 계속 수정: stay, the draft intact. */
    stay: () => blocker.reset?.(),
    /** 나가기: discard the draft and proceed with the held navigation. */
    leave: () => {
      leavingRef.current = true;
      blocker.proceed?.();
    },
  };
}
