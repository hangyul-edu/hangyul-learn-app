import { useEffect, type RefObject } from "react";

/**
 * Close a backdrop-less popup (a dropdown) on a press outside `ref` or on
 * Escape, while it is open. `ref` should wrap the trigger as well as the list:
 * a press on the trigger is then "inside" and left to its own toggle, rather
 * than being closed here and immediately reopened by the click that follows.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
    // `close` is a fresh closure each render; the listeners only need the
    // latest open state, which re-subscribes them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}
