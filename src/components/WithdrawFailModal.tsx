import { useEffect, useRef } from "react";

/**
 * Account-withdrawal FAILURE modal — shown only for a temporary / unexpected
 * error after the withdrawal API was attempted (network failure, timeout, 5xx,
 * or unknown). It calls no API, logs nobody out, and clears no state. The single
 * 확인 action just closes it (onClose) so the user can retry later. Backdrop is
 * non-dismissable; focus is trapped and restored to the opener on close.
 *
 * Not used for wrong-password / validation errors (those stay inline in the
 * password modal) or for success.
 */
export function WithdrawFailModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <path d="M24 9L43 40H5L24 9z" stroke="#E98282" strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M24 20v9" stroke="#E98282" strokeWidth="2.8" strokeLinecap="round" />
            <circle cx="24" cy="34" r="1.7" fill="#E98282" />
          </svg>
        </div>

        <h2 className="wfa__title" id="wfa-title">탈퇴에 실패했어요</h2>
        <p className="wfa__body" id="wfa-desc">
          일시적인 오류가 발생했어요
          <br />
          잠시 후 다시 시도해 주세요
        </p>

        <button className="wfa__btn" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
