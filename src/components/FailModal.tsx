import { useEffect, useRef, type ReactNode } from "react";

/**
 * Shared temporary-failure alert modal (withdrawal failed / logout failed / …).
 * Shown only for a retryable failure after the action's API was attempted. It
 * calls no API, logs nobody out, and clears no state — the single 확인 action
 * closes it (onClose) so the user can retry later. Backdrop is non-dismissable;
 * focus is trapped and restored to the opener on close.
 */
export function FailModal({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus();

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
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wfa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wfa-title"
        aria-describedby="wfa-desc"
      >
        <div className="wfa__icon" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <path d="M24 9L43 40H5L24 9z" stroke="#FF6F78" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M24 20v9" stroke="#FF6F78" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="24" cy="34" r="1.7" fill="#FF6F78" />
          </svg>
        </div>

        <h2 className="wfa__title" id="wfa-title">{title}</h2>
        <p className="wfa__body" id="wfa-desc">{description}</p>

        <button className="wfa__btn" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
