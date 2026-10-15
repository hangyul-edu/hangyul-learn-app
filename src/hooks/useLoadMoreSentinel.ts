import { useEffect, useRef, type DependencyList, type RefObject } from "react";

/**
 * Infinite lists: call `onHit` when the sentinel at the end of the list comes
 * within `rootMargin` of the viewport (or of `rootRef`, the list's own
 * scroller), while `enabled` (a page is left and none is in flight).
 *
 * The observer is rebuilt when `deps` change — after a page lands — because
 * observing fires at once for a sentinel still in view, so a short page keeps
 * loading until the list fills the screen.
 */
export function useLoadMoreSentinel(
  sentinelRef: RefObject<Element | null>,
  {
    enabled,
    onHit,
    rootRef,
    rootMargin,
  }: {
    enabled: boolean;
    onHit: () => void;
    rootRef?: RefObject<Element | null>;
    rootMargin: string;
  },
  deps: DependencyList,
) {
  const latest = useRef({ enabled, onHit });
  latest.current = { enabled, onHit };
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && latest.current.enabled) latest.current.onHit();
      },
      { root: rootRef?.current ?? null, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
