import { useEffect, useRef } from "react";
import { ATTENDANCE_COPY } from "../lib/attendanceCopy";
import type { AppLanguage } from "../lib/language";

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
  lang,
  onClose,
}: {
  pointsAwarded: number;
  streakDays: number;
  lang: AppLanguage;
  onClose: () => void;
}) {
  const copy = ATTENDANCE_COPY[lang];
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
        {/* Decorative only — never intercept touch (pointer-events: none via CSS). */}
        <span className="attn__deco attn__deco--peach-lg" aria-hidden="true" />
        <span className="attn__deco attn__deco--peach-sm" aria-hidden="true" />
        <span className="attn__deco attn__deco--dot attn__deco--dot-a" aria-hidden="true" />
        <span className="attn__deco attn__deco--dot attn__deco--dot-b" aria-hidden="true" />

        <button className="attn__close" onClick={onClose} aria-label={copy.closeA11y}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Illustration inside a dashed orange ring, with the points badge. */}
        <div className="attn__art">
          <div className="attn__ring" aria-hidden="true">
            <AttendanceArt />
          </div>
          <span className="attn__badge" aria-hidden="true">{copy.points(pointsAwarded)}</span>
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

/** Attendance reward illustration — a calendar with a check + a sparkle. */
function AttendanceArt() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <rect x="14" y="18" width="44" height="40" rx="8" fill="#ffffff" stroke="#ff8a3c" strokeWidth="3" />
      <path d="M14 28h44" stroke="#ff8a3c" strokeWidth="3" />
      <path d="M24 14v8M48 14v8" stroke="#ff8a3c" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 42l6 6 12-13" stroke="#ff5b00" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M57 16l1.6 3.4L62 21l-3.4 1.6L57 26l-1.6-3.4L52 21l3.4-1.6L57 16z" fill="#ffb26b" />
    </svg>
  );
}
