import { useTranslation } from "../i18n";
import icArrow from "../assets/brand/ic-16-arrow.svg";
/**
 * Bottom sheet shown after a CORRECT personalized-learning answer. Two mutually
 * exclusive modes with a distinct visual hierarchy:
 *
 * - "next"     — more items remain. Buttons: 다시 시작 / 다음. No scrim; the
 *                learning screen behind stays fully interactive-looking.
 * - "complete" — the final required item was just completed correctly. Buttons:
 *                다시 시작 / 완료. A light dim scrim de-emphasizes (and blocks) the
 *                learning screen behind the sheet — NOT blurred, so the learner
 *                can still read the item they just completed. The session
 *                finishes only when the user presses 완료.
 */
export type CorrectAnswerSheetMode = "next" | "complete";

export function CorrectAnswerSheet({
  mode,
  onRetry,
  onNext,
  onComplete,
  advancing,
  completing,
}: {
  mode: CorrectAnswerSheetMode;
  /** Re-arms the current item so it can be answered again — NOT an audio replay. */
  onRetry: () => void;
  onNext: () => void;
  onComplete: () => void;
  advancing?: boolean;
  completing?: boolean;
}) {
  const { t } = useTranslation();
  const spinner = <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />;
  return (
    <>
      {/* Completion-only dim layer behind the sheet (blocks interaction, not blurred). */}
      {mode === "complete" && <div className="casheet__scrim" aria-hidden="true" />}

      <div
        className={`casheet casheet--${mode}`}
        role="group"
        aria-label={t(mode === "complete" ? "session.learningComplete" : "session.answerNext")}
      >
        <div className="casheet__row">
          <button
            type="button"
            /* --replay is the shared class for this sheet's left tile; the
               review sheet uses it for the same retry action. */
            className="casheet__btn casheet__btn--replay"
            onClick={onRetry}
            aria-label={t("session.retry")}
          >
            {t("session.retry")}
          </button>

          {mode === "next" ? (
            <button
              type="button"
              className="casheet__btn casheet__btn--next"
              onClick={onNext}
              disabled={advancing}
              aria-label={t("session.nextQuestion")}
            >
              {advancing ? (
                spinner
              ) : (
                <>
                  {t("session.next")}
                  <span className="casheet__arrows" aria-hidden="true">
                    <img src={icArrow} alt="" />
                    <img src={icArrow} alt="" />
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="casheet__btn casheet__btn--complete"
              onClick={onComplete}
              disabled={completing}
              aria-label={t("session.learningComplete")}
            >
              {completing ? spinner : t("session.complete")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
