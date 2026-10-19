import type { SessionConversationCopy } from "../../lib/sessionConversationCopy";
import type { BlankAttempt, SpeechAttempt } from "../../lib/types";

/** Which input produced the last evaluated attempt — decides whether the
 * pronunciation panel (voice only) is shown. */
export type AttemptMode = "keyboard" | "voice";

/** The hint chip's stage for one sentence (absent = untouched). */
export type HintStage = "hint" | "answer";

/** Map the fill-in-the-blank result onto the existing SpeechAttempt feedback
 * shape so the correct/incorrect/progress UI is reused unchanged. */
export function blankToSpeech(blank: BlankAttempt): SpeechAttempt {
  return {
    attempt_id: blank.attempt_id,
    correct: blank.is_correct,
    transcription: blank.transcription ?? blank.normalized_answer,
    target_text: blank.completed_sentence,
    pronunciation_score: blank.is_correct ? 100 : 0,
    feedback_code: blank.is_correct ? "correct" : "missed_words",
    points_earned: blank.points_earned,
    daily_progress: blank.daily_progress ?? null,
  };
}

/** Actionable pronunciation feedback from the evaluation result. Prefers the
 * server's already-localized tips; falls back to a safe localized message so a
 * raw provider/API error is never surfaced to the learner. */
export function pronunciationMessage(attempt: SpeechAttempt, copy: SessionConversationCopy): string {
  // Something else entirely was said: pronunciation advice would mislead.
  if (attempt.feedback_code === "unrelated_speech") return copy.unrelatedSpeech;
  const tip = attempt.tips?.find((line) => line.trim().length > 0);
  if (tip?.trim()) return tip.trim();
  // No provider tip: at least show what the recognizer heard, so the
  // learner knows whether to speak more clearly or say something else.
  const heard = attempt.transcription?.trim();
  if (heard && !attempt.correct) return copy.heardAs(heard);
  return copy.pronunciationFallback;
}
