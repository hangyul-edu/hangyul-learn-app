import type { ReactNode } from "react";
import type { TopikSessionCopy } from "../../lib/topikSessionCopy";

/** Verdict shown in the card's result header. `none` = pre-submission (only the
 * bookmark shows); `correct` = blue check + success title; `incorrect` = coral
 * exclamation + retry title. Writing answers stay `none` (they are scored, not
 * marked right/wrong — the score is rendered separately). */
export type ResultStatus = "none" | "correct" | "incorrect";

/**
 * The horizontal header at the top of the TOPIK question card: the save/bookmark
 * control is always pinned to the far right and keeps its position across every
 * state. On its left:
 *  - before an answer (status `none`): the question directive/heading (`title`),
 *    so every question shows its instruction — same as before the redesign;
 *  - after a graded selection answer: the circular status badge + verdict, which
 *    replaces the heading.
 */
export function ResultHeader({
  status,
  title,
  copy,
  bookmark,
}: {
  status: ResultStatus;
  /** Question directive shown before answering (e.g. "문제를 풀어보세요"). */
  title: string;
  copy: TopikSessionCopy;
  /** The save/bookmark button — owned by the screen (holds its saved state). */
  bookmark: ReactNode;
}) {
  return (
    <div className="tq-head">
      {status === "none" ? (
        <p className="sess__instr sess__instr--topik">{title}</p>
      ) : (
        <div
          className={`tq-head__status tq-head__status--${status}`}
          role="status"
          aria-live="polite"
        >
          <span className="tq-head__badge" aria-hidden="true">
            {status === "correct" ? <CheckBadge /> : <BangBadge />}
          </span>
          <span className="tq-head__title">
            {status === "correct" ? copy.resultCorrectTitle : copy.resultRetryTitle}
          </span>
        </div>
      )}
      {bookmark}
    </div>
  );
}

/** Blue disc + white check — the correct-answer badge. Sized to match the
 * Conversation session's verdict badge (26px, viewBox 24). */
function CheckBadge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#5B7FF5" />
      <path
        d="M7 12.5l3.2 3.2L17 8.8"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Coral disc + white exclamation — the retry (incorrect) badge. */
function BangBadge() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#FF7079" />
      <path d="M12 6.4v7.2" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="17.2" r="1.4" fill="#fff" />
    </svg>
  );
}
