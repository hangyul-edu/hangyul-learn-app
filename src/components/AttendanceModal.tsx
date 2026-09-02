import { useEffect, useRef } from "react";
import { useAttendanceCopy } from "../lib/attendanceCopy";
import attendanceRing from "../assets/brand/attendance-ring.png";
import attendanceFruit from "../assets/brand/attendance-tangerine.svg";

/**
 * Daily-attendance completion modal. Shown ONLY after the server confirms a
 * freshly-recorded check-in with points awarded (see AttendanceGate) — it
 * performs no API call and all values come from the API response.
 *
 * Backdrop is non-dismissable (per the reference, avoid accidental close);
 * closing is via the top-right X or the bottom 확인/Confirm button, or Escape.
 * Focus is trapped and restored to the previously-focused element on close.
 */
export function AttendanceModal({
  pointsAwarded,
  streakDays,
  onClose,
}: {
  pointsAwarded: number;
  streakDays: number;
  onClose: () => void;
}) {
  const copy = useAttendanceCopy();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // block background scrolling
    confirmRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    // Non-dismissable backdrop: no onClick handler on the overlay.
    <div className="overlay overlay--center attn__overlay">
      <div
        ref={dialogRef}
        className="attn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="attn-title"
        aria-describedby="attn-streak"
        aria-label={copy.dialogA11y}
      >
        {/* Figma MAI-003 Ellipse 1059-1062 — decorative only, never intercept
            touch (pointer-events: none via CSS). */}
        <span className="attn__deco attn__deco--a" aria-hidden="true" />
        <span className="attn__deco attn__deco--b" aria-hidden="true" />
        <span className="attn__deco attn__deco--c" aria-hidden="true" />
        <span className="attn__deco attn__deco--d" aria-hidden="true" />

        <button className="attn__close" onClick={onClose} aria-label={copy.closeA11y}>
          {/* Figma ic_B_topNav — two 16px diagonals, 1.5 round stroke, in a 24
              box. The shared component's own export is teal; this instance
              overrides it to Brand color 1, so the stroke is `currentColor`. */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 4L4 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Figma Group 1410118883 — the dashed ring (Ellipse 1054) and the
            tangerine segment (Group 1410118270) are both exported artwork; the
            points badge sits over the ring's top-right. */}
        <div className="attn__art" aria-hidden="true">
          <img className="attn__ring" src={attendanceRing} alt="" />
          <img className="attn__fruit" src={attendanceFruit} alt="" />
          <span className="attn__badge">{copy.points(pointsAwarded)}</span>
        </div>

        <h2 className="attn__title" id="attn-title">{copy.title}</h2>
        <p className="attn__streak" id="attn-streak">{copy.streak(streakDays)}</p>

        <button ref={confirmRef} className="attn__confirm" onClick={onClose} aria-label={copy.confirmA11y}>
          {copy.confirm}
        </button>
      </div>
    </div>
  );
}
