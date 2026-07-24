/**
 * Bottom sheet shown after a CORRECT personalized-learning answer. Two mutually
 * exclusive modes with a distinct visual hierarchy:
 *
 * - "next"     — more items remain. Buttons: 다시 듣기 / 다음. NO background blur;
 *                the learning screen behind stays sharp and readable.
 * - "complete" — the final required item was just completed correctly. Buttons:
 *                다시 듣기 / 완료. A blur scrim de-emphasizes (and blocks) the
 *                learning screen behind the sheet, which itself stays crisp. The
 *                session finishes only when the user presses 완료.
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
  const spinner = <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />;
  return (
    <>
      {/* Completion-only blur layer, behind the sheet (never blurs the sheet). */}
      {mode === "complete" && <div className="casheet__scrim" aria-hidden="true" />}

      <div
        className={`casheet casheet--${mode}`}
        role="group"
        aria-label={mode === "complete" ? "학습 완료" : "정답, 다음으로"}
      >
        <div className="casheet__row">
          <button
            type="button"
            className="casheet__btn casheet__btn--replay"
            onClick={onReplay}
            disabled={replaying}
            aria-label="다시 듣기"
          >
            {replaying ? spinner : "다시 듣기"}
          </button>

          {mode === "next" ? (
            <button
              type="button"
              className="casheet__btn casheet__btn--next"
              onClick={onNext}
              disabled={advancing}
              aria-label="다음 문제로"
            >
              {advancing ? (
                spinner
              ) : (
                <>
                  다음
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="casheet__btn casheet__btn--complete"
              onClick={onComplete}
              disabled={completing}
              aria-label="학습 완료"
            >
              {completing ? spinner : "완료"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
