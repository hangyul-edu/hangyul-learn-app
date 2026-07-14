import { useEffect, useRef } from "react";

/**
 * Account-withdrawal completion modal. Shown ONLY after the backend confirms
 * terminal withdrawal success (deleteAccount resolved). It never calls any API.
 * The X and 확인 perform the identical terminal action (`onClose`): the parent
 * runs the centralized cleanup (hardSignOut → clears tokens + current-user +
 * every user-scoped query cache) and resets navigation to the logged-out root.
 *
 * Backdrop is non-dismissable; X / 확인 / Escape all complete the flow. Focus is
 * trapped; there is no authenticated screen to return to.
 */
export function WithdrawDoneModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        aria-labelledby="wdd-title"
        aria-describedby="wdd-desc"
      >
        <button className="wdd__close" onClick={onClose} aria-label="탈퇴 완료 창 닫기">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="wdd__icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M13 24.5l7 7 15-15" stroke="#55C7CB" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="wdd__title" id="wdd-title">탈퇴가 완료됐습니다</h2>
        <p className="wdd__copy" id="wdd-desc">
          그동안 이용해 주셔서 감사합니다
          <br />
          더 나은 서비스로 다시 찾아뵙겠습니다
        </p>

        <button className="wdd__btn" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
