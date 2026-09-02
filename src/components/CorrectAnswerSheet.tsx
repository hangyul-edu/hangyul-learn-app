import { useTranslation } from "../i18n";
import icArrow from "../assets/brand/ic-16-arrow.svg";
/**
 * Bottom sheet shown after a CORRECT personalized-learning answer. Two mutually
 * exclusive modes with a distinct visual hierarchy:
 *
 * - "next"     — more items remain. Buttons: 다시 듣기 / 다음. No scrim; the
 *                learning screen behind stays fully interactive-looking.
 * - "complete" — the final required item was just completed correctly. Buttons:
 *                다시 듣기 / 완료. A light dim scrim de-emphasizes (and blocks) the
 *                learning screen behind the sheet — NOT blurred, so the learner
 *                can still read the item they just completed. The session
 *                finishes only when the user presses 완료.
 */
export type CorrectAnswerSheetMode = "next" | "complete";

export function CorrectAnswerSheet({
  mode,
  onReplay,
  onNext,
  onComplete,
  replaying,
  advancing,
  completing,
}: {
  mode: CorrectAnswerSheetMode;
  onReplay: () => void;
  onNext: () => void;
  onComplete: () => void;
  replaying?: boolean;
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
            className="casheet__btn casheet__btn--replay"
            onClick={onReplay}
            disabled={replaying}
            aria-label={t("session.listenAgain")}
          >
            {replaying ? spinner : t("session.listenAgain")}
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
