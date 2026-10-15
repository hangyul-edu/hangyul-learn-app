import { useId, useRef } from "react";
import doneBadge from "../assets/brand/ic-modal-done.svg";
import { useModalFocus } from "../hooks/useModalFocus";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus goes to the title so screen readers announce success; Tab then
  // stays on the one button.
  useModalFocus({ open, containerRef: dialogRef, onEscape: onConfirm, initialFocus: titleRef });

  if (!open) return null;

  return (
    <div className="overlay overlay--center lsm__overlay">
      <div
        ref={dialogRef}
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

        <button className="wdd__btn" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
