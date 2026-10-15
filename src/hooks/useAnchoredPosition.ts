import { useLayoutEffect, useState, type RefObject } from "react";
import { rectInFrame } from "../lib/frame";

type FrameRect = ReturnType<typeof rectInFrame>;

/**
 * Where a `position: fixed` menu sits while `open`: `place` maps the
 * trigger's rect — in the app frame's coordinates, which differ from the
 * window's on desktop — to the menu's top/left. Re-measured on resize and on
 * any scroll; null while closed.
 */
export function useAnchoredPosition(
  triggerRef: RefObject<HTMLElement | null>,
  open: boolean,
  place: (rect: FrameRect) => { top: number; left: number },
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const r = triggerRef.current ? rectInFrame(triggerRef.current) : null;
      if (r) setPos(place(r));
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // `place` is a fixed formula per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return pos;
}
