import { ApiError } from "./http";
import type {
  Quiz,
  QuizAttemptResult,
  Sentence,
  SpeechAttempt,
  StudyActivity,
  StudyAttemptResult,
  StudyReveal,
  StudySession,
} from "./types";

/**
 * Adapters between adaptive study sessions (/study-sessions) and the shapes the
 * existing session screens already render. The screens keep their UI; only the
 * item source and the grading call change. An adapted item carries its
 * `activity_id` (and the session's reveal once allowed) so the screen can tell
 * a session activity from a legacy recommendation item.
 */
export type StudySentence = Sentence & { activity_id: string; reveal: StudyReveal | null };
export type StudyQuiz = Quiz & { activity_id: string; reveal: StudyReveal | null };

const OPEN = new Set(["pending", "presented", "attempted"]);

export function isStudyItem<T extends object>(item: T | null | undefined): item is T & { activity_id: string; reveal: StudyReveal | null } {
  return !!item && "activity_id" in item;
}

/** Still answerable on the server (graded attempts are accepted). */
export function isOpenActivity(a: StudyActivity): boolean {
  return OPEN.has(a.status);
}

/** An attempt's `activity_status` that takes no more graded answers. */
export function isClosedStatus(status: string): boolean {
  return !OPEN.has(status);
}

/** The language session explanations are written in: Korean, else English. */
export function explanationLanguage(language: string): "ko" | "en" {
  return language === "ko" ? "ko" : "en";
}

/** A server message sent in both languages, in the app's. */
export function localizedMessage(message: { ko: string; en: string }, language: string): string {
  return language === "ko" ? message.ko : message.en;
}

/** Activities shown to the learner: the current plan minus withdrawn items. */
export function visibleActivities(s: StudySession): StudyActivity[] {
  return [...s.activities].filter((a) => a.status !== "withdrawn" && a.status !== "replaced").sort((x, y) => x.position - y.position);
}

export function answeredCorrectly(a: StudyActivity): boolean {
  return a.attempts.some((t) => t.correct === true);
}

/** The key used by the screens' per-item maps (bookmark/audio need the catalog id). */
export function sentenceKey(a: StudyActivity): string {
  return a.sentence_id ?? a.activity_id;
}

export function activityToSentence(a: StudyActivity, level: number): StudySentence {
  const c = a.content as {
    display_text?: string;
    translation?: string;
    translation_language?: string;
    romanization?: string | null;
    blanks?: { index: number; start?: number; length?: number }[];
  };
  return {
    activity_id: a.activity_id,
    reveal: a.reveal,
    sentence_id: sentenceKey(a),
    // The full sentence is part of the answer: known only after the reveal.
    korean: revealedKorean(a.reveal) ?? c.display_text ?? "",
    display_text: c.display_text ?? null,
    blanks: (c.blanks ?? []).map((b) => ({
      index: b.index,
      blank_id: `${a.activity_id}:${b.index}`,
      start: b.start ?? null,
      length: b.length ?? null,
      revealed_text: "",
    })),
    translation: c.translation ?? "",
    translation_language: c.translation_language,
    romanization: c.romanization ?? null,
    level,
  };
}

export function quizKey(a: StudyActivity): string {
  return a.quiz_id ?? a.activity_id;
}

export function activityToQuiz(a: StudyActivity, level: number): StudyQuiz {
  const c = a.content as {
    answer_format?: Quiz["answer"]["format"];
    material_kind?: string;
    topik_section?: string | null;
    topik_question_type?: string | null;
    prompt?: string;
    prompt_translation?: string | null;
    content_html?: string | null;
    image_url?: string | null;
    choices?: string[];
    choice_keys?: string[];
    blanks?: { label: string }[];
    answer_max_length?: number | null;
    answer_min_length?: number | null;
    scoring_criteria?: string[];
    max_score?: number | null;
  };
  const keys = c.choice_keys ?? [];
  return {
    activity_id: a.activity_id,
    reveal: a.reveal,
    quiz_id: quizKey(a),
    prompt: c.prompt ?? "",
    prompt_translation: c.prompt_translation ?? null,
    level,
    material: { kind: c.material_kind ?? "text", html: c.content_html ?? null, image_url: c.image_url ?? null, audio: null },
    answer: {
      format: c.answer_format ?? "single_choice",
      choices: (c.choices ?? []).map((text, i) => ({ key: keys[i] ?? String(i + 1), text })),
      blanks: c.blanks ?? [],
      min_length: c.answer_min_length ?? null,
      max_length: c.answer_max_length ?? null,
      scoring_criteria: c.scoring_criteria ?? [],
      max_score: c.max_score ?? null,
    },
    topik_section: c.topik_section ?? null,
    topik_question_type: c.topik_question_type ?? null,
  };
}

export function revealedKorean(reveal: StudyReveal | null | undefined): string | null {
  const k = reveal?.answer_key?.korean;
  return typeof k === "string" && k ? k : null;
}

/** The blank's answer text (joined when a sentence has several blanks). */
export function revealedBlankAnswer(reveal: StudyReveal | null | undefined): string {
  return (reveal?.answer_key?.blanks ?? [])
    .map((b) => (b.answer ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export function revealedChoiceKey(reveal: StudyReveal | null | undefined): string | null {
  const k = reveal?.answer_key?.correct_answer;
  return k == null ? null : String(k);
}

function norm(text: string): string {
  return text.normalize("NFC").replace(/[\s.,!?·'"“”‘’~…-]/g, "").toLowerCase();
}

/**
 * Practice re-answer of an activity the server has already closed (다시 시작,
 * or after the attempts ran out and the answer was shown). Nothing is recorded
 * or credited, so it is checked here against the revealed key: the blank's
 * phrase or the whole sentence, ignoring spacing and punctuation.
 */
export function practiceSentenceCorrect(reveal: StudyReveal | null, typed: string): boolean {
  if (!reveal) return false;
  const answer = revealedBlankAnswer(reveal);
  const full = revealedKorean(reveal) ?? "";
  const t = norm(typed);
  return !!t && (t === norm(answer) || (!!full && t === norm(full)));
}

/** Map a session attempt onto the conversation screen's feedback shape. */
export function studyToSpeech(res: StudyAttemptResult, activityId: string, typed: string): SpeechAttempt {
  return {
    attempt_id: `${activityId}:${res.attempt_no}`,
    correct: !!res.correct,
    transcription: res.transcription ?? typed,
    target_text: revealedKorean(res.reveal) ?? "",
    pronunciation_score: res.correct ? 100 : 0,
    feedback_code: res.correct ? "correct" : "missed_words",
    points_earned: res.points_earned,
    daily_progress: res.daily_progress
      ? { track_id: res.daily_progress.track_id, target: res.daily_progress.target, current: res.daily_progress.current, achieved: res.daily_progress.achieved }
      : null,
  };
}

/** Map a session attempt onto the TOPIK screen's result shape. */
export function studyToQuizResult(res: StudyAttemptResult, activityId: string): QuizAttemptResult {
  return {
    attempt_id: `${activityId}:${res.attempt_no}`,
    correct: res.correct,
    status: "graded",
    points_earned: res.points_earned,
    completed_now: res.completed_now,
    daily_progress: res.daily_progress,
  };
}

/** True when the error is the API's `code` (e.g. `session.no_eligible_content`). */
export function isApiCode(e: unknown, code: string): boolean {
  return e instanceof ApiError && e.code === code;
}
