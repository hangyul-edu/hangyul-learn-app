import type { TopikSessionCopy } from "../../lib/topikSessionCopy";
import type { Quiz } from "../../lib/types";
import type { AnswerValue } from "../QuestionView";
import { FillBlanks } from "./question/FillBlanks";
import { questionKind } from "./question/kind";
import { MultipleChoice } from "./question/MultipleChoice";
import { UnsupportedQuestion, type OptionResultState } from "./question/parts";
import { Writing } from "./question/Writing";

export { canSubmitTopik, questionKind } from "./question/kind";
export type { OptionResultState } from "./question/parts";

/** One TOPIK question in its answer format (see ./question). */
export function TopikQuestion({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  optionResult,
  tone = "neutral",
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy: TopikSessionCopy;
  /** Result markers for MC options (blue correct / red wrong). Absent = none. */
  optionResult?: OptionResultState;
  /** Visual tone of the audio player — `incorrect` gives it the warm cream tint
   *  that matches the retry state; `neutral` otherwise. */
  tone?: "neutral" | "incorrect";
}) {
  const kind = questionKind(quiz);
  return (
    <div className="tq">
      {/* Gray instruction line = the server prompt (never hardcoded per type). */}
      <p className="tq__instruction">{quiz.prompt}</p>
      {quiz.prompt_translation && <p className="tq__instruction-sub">{quiz.prompt_translation}</p>}

      {kind === "reading_multiple_choice" && (
        <MultipleChoice quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} optionResult={optionResult} />
      )}
      {kind === "listening_multiple_choice" && (
        <MultipleChoice
          quiz={quiz}
          value={value}
          onChange={onChange}
          disabled={disabled}
          copy={copy}
          listening
          tone={tone}
          optionResult={optionResult}
        />
      )}
      {kind === "writing_fill_blanks" && (
        <FillBlanks quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} tone={tone} />
      )}
      {(kind === "writing_data_response" || kind === "writing_opinion_essay") && (
        <Writing quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} tone={tone} />
      )}
      {kind === "unsupported" && <UnsupportedQuestion copy={copy} />}
    </div>
  );
}
