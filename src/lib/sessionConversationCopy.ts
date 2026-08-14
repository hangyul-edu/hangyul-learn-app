import type { AppLanguage } from "./language";

/**
 * Localized copy for the personalized-learning conversation session, focused on
 * the incorrect-answer / retry / pronunciation-feedback states (mirrors the
 * LANGUAGE_SETTINGS_COPY / ATTENDANCE_COPY pattern until a full i18n framework
 * exists). No Korean/English literals for these states live in the component.
 */
export interface SessionConversationCopy {
  /** Bold status shown in the incorrect-answer card header. */
  incorrectStatus: string;
  /** Bottom-action buttons. `hint` is the first tap (reveal one character);
   * after that the same button becomes `answer` (reveal the whole answer). */
  hint: string;
  answer: string;
  voiceMode: string;
  keyboardMode: string;
  /** Pronunciation feedback panel (voice only). */
  pronunciationTitle: string;
  /** Safe fallback when the evaluation returns no actionable tip. */
  pronunciationFallback: string;
  /** Accessible label for the circular score, e.g. "Pronunciation accuracy: 25 percent". */
  scoreA11y: (percent: number) => string;
  /** Toast when the attempt could not be evaluated (never the raw provider error). */
  evaluationError: string;
  /** Toast when recording/evaluation should simply be retried (network hiccup). */
  retryMessage: string;
  /** Toast when the browser denies microphone access. */
  micPermission: string;
  /** A11y labels. */
  bookmarkSave: string;
  bookmarkUnsave: string;
  recordA11y: string;
  stopRecordA11y: string;
  micRetryA11y: string;
}

export const SESSION_CONVERSATION_COPY: Record<AppLanguage, SessionConversationCopy> = {
  ko: {
    incorrectStatus: "다시 생각해보세요",
    hint: "힌트보기",
    answer: "정답보기",
    voiceMode: "음성 모드",
    keyboardMode: "키보드 모드",
    pronunciationTitle: "발음 정확도",
    pronunciationFallback: "조금 더 또렷하게 말해보세요.",
    scoreA11y: (percent) => `발음 정확도 ${percent} 퍼센트`,
    evaluationError: "채점하지 못했어요. 잠시 후 다시 시도해 주세요.",
    retryMessage: "네트워크 연결을 확인한 후 다시 시도해 주세요.",
    micPermission: "마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.",
    bookmarkSave: "저장",
    bookmarkUnsave: "저장 해제",
    recordA11y: "따라 말하기",
    stopRecordA11y: "녹음 멈추기",
    micRetryA11y: "다시 녹음하기",
  },
  en: {
    incorrectStatus: "Give it another try",
    hint: "Hint",
    answer: "Answer",
    voiceMode: "Voice mode",
    keyboardMode: "Keyboard mode",
    pronunciationTitle: "Pronunciation accuracy",
    pronunciationFallback: "Try saying it a little more clearly.",
    scoreA11y: (percent) => `Pronunciation accuracy: ${percent} percent`,
    evaluationError: "We couldn't score that. Please try again shortly.",
    retryMessage: "Check your network connection and try again.",
    micPermission: "Microphone access is needed. Please check your browser settings.",
    bookmarkSave: "Save",
    bookmarkUnsave: "Remove from saved",
    recordA11y: "Speak the sentence",
    stopRecordA11y: "Stop recording",
    micRetryA11y: "Record again",
  },
};
