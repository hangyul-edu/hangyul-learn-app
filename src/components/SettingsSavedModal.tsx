import { useEffect, useId, useRef } from "react";
import doneBadge from "../assets/brand/ic-modal-done.svg";

/**
 * Post-save success modal for settings screens — Figma `cp_G_01_modals`
 * (image + title + description + one button). Shown ONLY after the backend
 * confirms the save; it performs no API call. Used by Language Settings and the
 * per-track learning settings (level / daily goal).
 *
 * Reuses the shared success-modal design system (`.wdd*` — pale-mint circle +
 * turquoise check, dark title, muted copy, orange CTA) but, unlike the terminal
 * withdrawal/logout `SuccessModal`, has no top-right X: the single orange button
 * closes it and the caller then returns to the previous screen. Backdrop is
 * non-dismissable; the button / Escape confirm. Focus is trapped and restored to
 * the prior element on close.
 */
export function SettingsSavedModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move accessibility focus to the title so screen readers announce success.
    titleRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onConfirm();
        return;
      }
      // Only one interactive control — keep focus trapped on it.
      if (e.key === "Tab") {
        e.preventDefault();
        btnRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onConfirm]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center lsm__overlay">
      <div
        className="wdd lsm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="wdd__icon" aria-hidden="true">
          <img src={doneBadge} alt="" />
        </div>

        <h2 className="wdd__title" id={titleId} tabIndex={-1} ref={titleRef}>
          {title}
        </h2>
        <p className="wdd__copy" id={descId}>{description}</p>

        <button ref={btnRef} className="wdd__btn" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
