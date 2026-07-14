import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared terminal-success modal (account-withdrawal complete / logout complete).
 * Shown ONLY after the backend confirms the terminal operation — it never calls
 * any API. The top-right X and the orange 확인 perform the identical terminal
 * action (`onClose`): the parent runs the centralized cleanup + navigation reset.
 *
 * Backdrop is non-dismissable; X / 확인 / Escape all complete the flow. Focus is
 * trapped; there is no authenticated screen to return to.
 */
export function SuccessModal({
  open,
  title,
  description,
  closeAriaLabel,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  closeAriaLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    // Focus the primary action.
    focusables().find((b) => b.classList.contains("wdd__btn"))?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
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
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="succ-title"
        aria-describedby="succ-desc"
      >
        <button className="wdd__close" onClick={onClose} aria-label={closeAriaLabel}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="wdd__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M13 24.5l7 7 15-15" stroke="#55C7CB" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="wdd__title" id="succ-title">{title}</h2>
        <p className="wdd__copy" id="succ-desc">{description}</p>

        <button className="wdd__btn" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
