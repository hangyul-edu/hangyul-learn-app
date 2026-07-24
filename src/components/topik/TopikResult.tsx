import type { TopikSessionCopy } from "../../lib/topikSessionCopy";
import type { QuizAttemptResult } from "../../lib/types";

/**
 * Structured attempt result for the TOPIK page. One envelope renders three
 * shapes from the server response:
 *  - writing → a score against max_score plus suggestions, grammar feedback, and
 *    a corrected version (this feedback was previously computed but never shown);
 *  - deferred writing (status "submitted", no score yet) → an awaiting-review state;
 *  - selection / fill-blank → correct/incorrect with the representative answer.
 */
export function TopikResult({
  result,
  copy,
}: {
  result: QuizAttemptResult;
  copy: TopikSessionCopy;
}) {
  const w = result.writing;

  if (!w && result.status === "submitted") {
    return (
      <div className="tq-result tq-result--pending" role="status">
        {copy.awaitingReview}
      </div>
    );
  }

  if (w) {
    return (
      <div className="tq-result tq-result--writing">
        <div className="tq-result__score" role="status" aria-label={copy.scoreA11y(w.score)}>
          <span className="tq-result__score-num">{w.score}</span>
          <span className="tq-result__score-max">/ {w.max_score}</span>
        </div>
        {w.suggestions.length > 0 && (
          <FeedbackList title={copy.suggestionsTitle} items={w.suggestions} />
        )}
        {w.grammar_issues.length > 0 && (
          <FeedbackList title={copy.grammarTitle} items={w.grammar_issues} />
        )}
        {w.corrected_text && (
          <div className="tq-result__block">
            <div className="tq-result__block-title">{copy.correctedTitle}</div>
            <p className="tq-result__corrected">{w.corrected_text}</p>
          </div>
        )}
        {result.explanation && <p className="tq-result__explain">{result.explanation}</p>}
      </div>
    );
  }

  return (
    <div className={`tq-result ${result.correct ? "tq-result--ok" : "tq-result--no"}`} role="status">
      <span className="tq-result__verdict">
        {result.correct ? copy.correct : copy.incorrect}
        {!result.correct && result.correct_answer
          ? ` · ${copy.correctAnswerLabel(result.correct_answer)}`
          : ""}
      </span>
      {result.explanation && <p className="tq-result__explain">{result.explanation}</p>}
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="tq-result__block">
      <div className="tq-result__block-title">{title}</div>
      <ul className="tq-result__list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
