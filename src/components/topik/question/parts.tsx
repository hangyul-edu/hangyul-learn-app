import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import type { TopikSessionCopy } from "../../../lib/topikSessionCopy";
import type { Quiz } from "../../../lib/types";
import type { AnswerValue } from "../../QuestionView";

/** What every answer format takes. */
export type FormatProps = {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy: TopikSessionCopy;
  /** `incorrect` after a wrong attempt (the warm retry tint). */
  tone?: "neutral" | "incorrect";
};

/** Per-option result markers for a multiple-choice question after submission:
 * the correct/selected option renders blue, previously-submitted wrong options
 * render red. Empty during answering (no result yet). */
export interface OptionResultState {
  /** The key to render blue: the selected option once the answer is correct. */
  correctKey?: string | null;
  /** Keys submitted and confirmed wrong for the current question (rendered red). */
  wrongKeys?: readonly string[];
}

/** Server-authored passage / table / guiding-questions HTML, reduced to text
 * markup before rendering (see lib/sanitizeHtml). */
export function Passage({ html }: { html: string }) {
  return <div className="tq-passage" dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

export function UnsupportedQuestion({ copy }: { copy: TopikSessionCopy }) {
  return (
    <div className="tq-unsupported" role="alert">
      {copy.unsupported}
    </div>
  );
}
