import { useEffect, useRef } from "react";
import doneBadge from "../assets/brand/ic-modal-done.svg";

/**
 * Post-save success modal for Language Settings. Shown ONLY after the backend
 * confirms the language was persisted; it performs no API call.
 *
 * Reuses the shared success-modal design system (`.wdd*` — pale-mint circle +
 * turquoise check, dark title, muted copy, orange CTA) but, unlike the terminal
 * withdrawal/logout `SuccessModal`, has no top-right X: the single orange 확인
 * closes it and returns to the previous screen. Backdrop is non-dismissable;
 * 확인 / Escape confirm. Focus is trapped and restored to the prior element on
 * close.
 */
export function LanguageSavedModal({
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
        aria-labelledby="lang-saved-title"
        aria-describedby="lang-saved-desc"
      >
        <div className="wdd__icon" aria-hidden="true">
          <img src={doneBadge} alt="" />
        </div>

        <h2 className="wdd__title" id="lang-saved-title" tabIndex={-1} ref={titleRef}>
          {title}
        </h2>
        <p className="wdd__copy" id="lang-saved-desc">{description}</p>

        <button ref={btnRef} className="wdd__btn" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
