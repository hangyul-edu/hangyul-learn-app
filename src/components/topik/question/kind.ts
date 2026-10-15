import { countTopikChars } from "../../../lib/topikChars";
import type { Quiz, TopikQuestionFormat } from "../../../lib/types";
import type { AnswerValue } from "../../QuestionView";

/** The five learner-facing TOPIK formats plus a safe fallback. */
export type Kind = TopikQuestionFormat | "unsupported";

const KNOWN: readonly TopikQuestionFormat[] = [
  "reading_multiple_choice",
  "listening_multiple_choice",
  "writing_fill_blanks",
  "writing_data_response",
  "writing_opinion_essay",
];

/** The question's discriminated type. Prefer the server-derived `question_type`;
 * if a payload predates it, fall back to deriving it from the answer/material
 * dimensions (mirrors the server classifier) so rendering never breaks. */
export function questionKind(quiz: Quiz): Kind {
  if (quiz.question_type && KNOWN.includes(quiz.question_type)) return quiz.question_type;
  const fmt = quiz.answer.format;
  if (fmt === "single_choice") {
    return quiz.material.kind === "audio" || quiz.topik_section === "listening"
      ? "listening_multiple_choice"
      : "reading_multiple_choice";
  }
  if (fmt === "short_answer") return "writing_fill_blanks";
  if (fmt === "free_response") {
    return quiz.material.kind === "table" ? "writing_data_response" : "writing_opinion_essay";
  }
  return "unsupported";
}

/** How many fill-in-the-blank fields the question renders. */
export function blankCount(quiz: Quiz): number {
  return quiz.answer.blanks.length || 1;
}

/** Whether the current answer is a valid, submittable payload for its type:
 * MC needs one selection; fill-blanks needs every blank filled; writing must be
 * within [min, max] using the shared character-count rule. */
export function canSubmitTopik(quiz: Quiz, v: AnswerValue): boolean {
  const kind = questionKind(quiz);
  if (kind === "reading_multiple_choice" || kind === "listening_multiple_choice") {
    return !!v.choiceKey;
  }
  if (kind === "writing_fill_blanks") {
    const blanks = v.blanks ?? [];
    return Array.from({ length: blankCount(quiz) }).every(
      (_, i) => (blanks[i] ?? "").trim().length > 0,
    );
  }
  if (kind === "writing_data_response" || kind === "writing_opinion_essay") {
    const count = countTopikChars(v.text ?? "");
    const min = quiz.answer.min_length ?? 1;
    const max = quiz.answer.max_length ?? Number.POSITIVE_INFINITY;
    return count >= min && count <= max;
  }
  return false;
}
