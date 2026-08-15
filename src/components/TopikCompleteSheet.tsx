/**
 * Bottom-up sheet shown when a Personalized-learning TOPIK session is finished
 * (the last required question was answered correctly). It slides up from the
 * bottom over a dimmed screen and offers a single 완료 button that finalizes the
 * session (opening the completion-summary modal) — mirroring the bottom sheet
 * that TOPIK Review Learning shows on completion.
 */
export function TopikCompleteSheet({
  onComplete,
  completing,
}: {
  onComplete: () => void;
  completing?: boolean;
}) {
  return (
    <>
      {/* Dim (not blurred) the finished screen behind the sheet, and block taps. */}
      <div className="casheet__scrim" aria-hidden="true" />
      <div className="casheet" role="group" aria-label="학습 완료">
        <button
          type="button"
          className="sess__next"
          onClick={onComplete}
          disabled={completing}
          aria-label="완료"
        >
          {completing ? (
            <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          ) : (
            "완료"
          )}
        </button>
      </div>
    </>
  );
}
