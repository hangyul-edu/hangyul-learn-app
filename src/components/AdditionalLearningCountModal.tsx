import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import { Spinner } from "./ui/Spinner";

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
  const { t } = useTranslation();
  const [selected, setSelected] = useState<AdditionalCount>(5);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSelected(5); // reset to the default each open
  }, [open]);
  useModalFocus({ open, containerRef: dialogRef, onEscape: onClose });

  if (!open) return null;

  const unit = t(kind === "conversation" ? "session.unitSentence" : "session.unitQuestion");

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
            aria-label={t("session.additionalCloseA11y")}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="#25282b" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          <p className="addlearn__eyebrow">{t("session.additionalTitle")}</p>
          <h2 className="addlearn__title" id="addlearn-title">
            {t("session.additionalPrompt", { unit })}
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
                  {t("session.countUnit", { n: c })}
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
            aria-label={t("session.additionalA11y", { unit, count: selected })}
          >
            {submitting ? (
              <Spinner size={22} stroke={2.5} />
            ) : (
              t("session.additionalStart")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
