import type { ReviewSessionCopy } from "../lib/reviewSessionCopy";

/**
 * Bottom action sheet shown after a saved item is reviewed correctly. Two equal
 * buttons over a blurred, non-interactive review screen — a secondary action on
 * the left (다시 시작 to redo, or 다시 듣기 for a listening item) and 완료 on the
 * right to finalize and open the reward modal. Reuses the correct-answer sheet's
 * styling (casheet).
 */
export function ReviewCompleteSheet({
  leftLabel,
  onLeft,
  onComplete,
  resetting,
  completing,
  copy,
}: {
  leftLabel: string;
  onLeft: () => void;
  onComplete: () => void;
  resetting?: boolean;
  completing?: boolean;
  copy: ReviewSessionCopy;
}) {
  const spinner = <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />;
  return (
    <>
      <div className="casheet__scrim" aria-hidden="true" />
      <div className="casheet casheet--complete" role="group" aria-label={copy.rewardTitle}>
        <div className="casheet__row">
          <button
            type="button"
            className="casheet__btn casheet__btn--replay"
            onClick={onLeft}
            disabled={resetting}
            aria-label={leftLabel}
          >
            {resetting ? spinner : leftLabel}
          </button>
          <button
            type="button"
            className="casheet__btn casheet__btn--complete"
            onClick={onComplete}
            disabled={completing}
            aria-label={copy.complete}
          >
            {completing ? spinner : copy.complete}
          </button>
        </div>
      </div>
    </>
  );
}
