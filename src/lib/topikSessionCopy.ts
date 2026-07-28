import type { AppLanguage } from "./language";

/**
 * Localized UI copy for the TOPIK personalized-learning question page, keyed by
 * the active app language (same pattern as the other *Copy.ts modules). The
 * question *content* is Korean by nature, but the surrounding chrome follows the
 * user's display-language setting.
 */
export interface TopikSessionCopy {
  title: string;
  submit: string;
  next: string;
  complete: string;
  /** Result-header title after a correct answer (blue check state). */
  resultCorrectTitle: string;
  /** Result-header title after a wrong answer (coral retry state). */
  resultRetryTitle: string;
  /** Fallback label for the listening track (the audio payload carries no title). */
  audioTrack: string;
  answerPlaceholder: string;
  blankPlaceholder: string;
  /** current/max character counter, e.g. "247/300". */
  charCount: (current: number, max: number) => string;
  minLengthHint: (min: number) => string;
  overMaxHint: (max: number) => string;
  correct: string;
  incorrect: string;
  correctAnswerLabel: (answer: string) => string;
  scoreLabel: (score: number, max: number) => string;
  suggestionsTitle: string;
  grammarTitle: string;
  correctedTitle: string;
  awaitingReview: string;
  unsupported: string;
  saveQuestion: string;
  removeSaved: string;
  audioPlay: string;
  audioPause: string;
  audioLoading: string;
  audioError: string;
  scoreA11y: (percent: number) => string;
}

export const TOPIK_SESSION_COPY: Record<AppLanguage, TopikSessionCopy> = {
  ko: {
    title: "문제를 풀어보세요",
    submit: "제출",
    next: "다음",
    complete: "완료",
    resultCorrectTitle: "정답이에요!",
    resultRetryTitle: "다시 풀어보세요",
    audioTrack: "Track 1",
    answerPlaceholder: "답을 입력하세요",
    blankPlaceholder: "답을 입력하세요",
    charCount: (current, max) => `${current}/${max}`,
    minLengthHint: (min) => `${min}자 이상 작성해 주세요.`,
    overMaxHint: (max) => `${max}자 이하로 작성해 주세요.`,
    correct: "정답이에요! 🎉",
    incorrect: "아쉬워요 💪",
    correctAnswerLabel: (answer) => `정답: ${answer}`,
    scoreLabel: (score, max) => `${score} / ${max}점`,
    suggestionsTitle: "이렇게 고쳐보세요",
    grammarTitle: "문법 피드백",
    correctedTitle: "고친 문장",
    awaitingReview: "제출됐어요. 채점을 기다리고 있어요 ✍️",
    unsupported: "이 문제 유형은 아직 지원되지 않아요. 다른 문제로 넘어가 주세요.",
    saveQuestion: "문제 저장",
    removeSaved: "저장 해제",
    audioPlay: "듣기 재생",
    audioPause: "듣기 멈춤",
    audioLoading: "불러오는 중",
    audioError: "오디오를 재생하지 못했어요.",
    scoreA11y: (percent) => `점수 ${percent}점`,
  },
  en: {
    title: "Solve the question",
    submit: "Submit",
    next: "Next",
    complete: "Done",
    resultCorrectTitle: "Correct!",
    resultRetryTitle: "Try again",
    audioTrack: "Track 1",
    answerPlaceholder: "Type your answer",
    blankPlaceholder: "Type your answer",
    charCount: (current, max) => `${current}/${max}`,
    minLengthHint: (min) => `Please write at least ${min} characters.`,
    overMaxHint: (max) => `Please keep it within ${max} characters.`,
    correct: "Correct! 🎉",
    incorrect: "Not quite 💪",
    correctAnswerLabel: (answer) => `Answer: ${answer}`,
    scoreLabel: (score, max) => `${score} / ${max}`,
    suggestionsTitle: "Suggestions",
    grammarTitle: "Grammar feedback",
    correctedTitle: "Corrected version",
    awaitingReview: "Submitted — waiting to be graded ✍️",
    unsupported: "This question type isn't supported yet. Please move on to another question.",
    saveQuestion: "Save question",
    removeSaved: "Remove saved question",
    audioPlay: "Play audio",
    audioPause: "Pause audio",
    audioLoading: "Loading",
    audioError: "Couldn't play the audio.",
    scoreA11y: (percent) => `Score ${percent}`,
  },
};
