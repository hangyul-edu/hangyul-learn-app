import { useEffect, useRef } from "react";

/**
 * Unsaved-changes confirmation modal. `계속하기` (left, gray) keeps the user on
 * the screen with their draft intact; `나가기` (right, orange) discards and
 * leaves. Calls no API. Backdrop is non-dismissable and Escape maps to 계속하기
 * (never 나가기). Focus is trapped and restored to the opener on close. Reuses
 * the shared two-button dialog styles (.lgo__*).
 */
export function UnsavedChangesModal({
  open,
  onContinue,
  onLeave,
}: {
  open: boolean;
  onContinue: () => void;
  onLeave: () => void;
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
    focusables()[0]?.focus(); // 계속하기 (safe default)

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onContinue();
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
  }, [open, onContinue]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div ref={dialogRef} className="lgo" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-desc">
        <h2 className="lgo__title" id="unsaved-title">변경사항을 저장하지 않고 나갈까요?</h2>
        <p className="lgo__copy" id="unsaved-desc">변경사항이 적용되지 않습니다</p>
        <div className="lgo__actions">
          <button className="lgo__btn lgo__btn--cancel" onClick={onContinue}>계속하기</button>
          <button className="lgo__btn lgo__btn--go" onClick={onLeave}>나가기</button>
        </div>
      </div>
    </div>
  );
}
