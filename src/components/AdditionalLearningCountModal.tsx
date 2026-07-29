import { useEffect, useRef, useState } from "react";

/** The extra-batch sizes offered after the daily goal is complete. Matches the
 * backend's EXTRA_LEARNING_COUNTS (5 / 10 / 15 / 20). */
export const ADDITIONAL_COUNTS = [5, 10, 15, 20] as const;
export type AdditionalCount = (typeof ADDITIONAL_COUNTS)[number];

/**
 * Additional-learning count modal, shown once the daily goal is 100% complete
 * and the user opts into extra study. They pick how many EXTRA sentences
 * (Conversation) or questions (TOPIK) to study — 5 / 10 / 15 / 20, defaulting to
 * 5 — and 시작할게요! starts a new session of exactly that size via `onStart`.
 *
 * For TOPIK this is the SECOND step (the section modal comes first), so the CTA
 * starts the session rather than opening another step. Closing (X / backdrop /
 * Escape) starts nothing and leaves daily progress untouched.
 */
export function AdditionalLearningCountModal({
  open,
  kind,
  submitting = false,
  onClose,
  onStart,
}: {
  open: boolean;
  /** Chooses the unit in the copy: 문장 (Conversation) vs 문제 (TOPIK). */
  kind: "conversation" | "topik";
  /** Session-create request in flight — disables the CTA and shows a spinner. */
  submitting?: boolean;
  onClose: () => void;
  onStart: (count: AdditionalCount) => void;
}) {
  const [selected, setSelected] = useState<AdditionalCount>(5);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(5); // reset to the default each open
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // no background scroll / shift

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

  const unit = kind === "conversation" ? "문장" : "문제";

  return (
    <div className="overlay overlay--center" onClick={submitting ? undefined : onClose}>
      <div
        ref={dialogRef}
        className="addlearn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addlearn-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="addlearn__scroll">
          <button
            className="addlearn__close"
            onClick={onClose}
            disabled={submitting}
            aria-label="닫기"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="#1c2126" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          <p className="addlearn__eyebrow">학습을 조금 더 이어가 볼까요?</p>
          <h2 className="addlearn__title" id="addlearn-title">
            추가할 {unit} 수를 선택해 주세요
          </h2>

          <div className="addlearn__options" role="radiogroup" aria-labelledby="addlearn-title">
            {ADDITIONAL_COUNTS.map((c) => {
              const active = c === selected;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`addlearn__option${active ? " addlearn__option--active" : ""}`}
                  onClick={() => setSelected(c)}
                  disabled={submitting}
                >
                  {c}개
                </button>
              );
            })}
          </div>
        </div>

        <div className="addlearn__footer">
          <button
            className="addlearn__cta"
            onClick={() => !submitting && onStart(selected)}
            disabled={submitting}
            aria-label={`추가 ${unit} ${selected}개로 학습 시작할게요`}
          >
            {submitting ? (
              <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} />
            ) : (
              "시작할게요!"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
