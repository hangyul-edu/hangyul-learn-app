import { useEffect, useRef, type RefObject } from "react";

/**
 * The keyboard and scroll contract of the app's centred alert modals, while
 * `open`: the background does not scroll, focus moves inside (and goes back
 * to the opener on close), Tab cycles through the dialog's controls, and
 * Escape runs `onEscape`.
 *
 * Tied to `open` alone: callers pass inline handlers and a pending flag, and
 * re-running on each would bounce focus out to the opener and back.
 */
export function useModalFocus({
  open,
  containerRef,
  onEscape,
  initialFocus = "first",
  focusDelayMs = 0,
  focusables = "button:not([disabled])",
  trap = true,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Escape's action; undefined while the modal cannot be dismissed (its
   * action is pending). */
  onEscape?: () => void;
  /** What takes focus on open: the first control, one matching a selector
   * inside the dialog, a specific element, or nothing. */
  initialFocus?: "first" | "none" | string | RefObject<HTMLElement | null>;
  /** Wait for the presentation animation before focusing (a field whose
   * keyboard would otherwise pop up mid-slide). */
  focusDelayMs?: number;
  /** The controls Tab cycles through. */
  focusables?: string;
  /** False leaves Tab alone (only Escape and the scroll lock apply). */
  trap?: boolean;
}) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const settings = useRef({ initialFocus, focusDelayMs, focusables, trap });
  settings.current = { initialFocus, focusDelayMs, focusables, trap };

  useEffect(() => {
    if (!open) return;
    const { initialFocus: target, focusDelayMs: delay, focusables: selector, trap: trapTab } = settings.current;
    const restore = target === "none" ? null : (document.activeElement as HTMLElement | null);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>(selector) ?? []);

    function focusInitial() {
      if (target === "none") return;
      if (target === "first") items()[0]?.focus();
      else if (typeof target === "string") containerRef.current?.querySelector<HTMLElement>(target)?.focus();
      else target.current?.focus();
    }
    const timer = delay ? window.setTimeout(focusInitial, delay) : undefined;
    if (!delay) focusInitial();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const escape = onEscapeRef.current;
        if (escape) {
          e.preventDefault();
          escape();
        }
        return;
      }
      if (e.key !== "Tab" || !trapTab) return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Focus on something that is not a control (a focused title) enters
      // the cycle rather than leaving the dialog.
      const outside = !active || !list.includes(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restore?.focus?.();
    };
  }, [open, containerRef]);
}
