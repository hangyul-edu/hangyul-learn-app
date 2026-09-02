import type { ReviewSessionCopy } from "../lib/reviewSessionCopy";

/**
 * Bottom action sheet shown after a saved item is reviewed correctly. Two equal
 * buttons over a dimmed (not blurred), non-interactive review screen — a secondary
 * action on the left (redo the item) and 완료 on the right to finalize and open
 * the reward modal. Every TOPIK question kind uses the same left action; only a
 * sentence review varies it. Reuses the correct-answer sheet's styling (casheet).
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
