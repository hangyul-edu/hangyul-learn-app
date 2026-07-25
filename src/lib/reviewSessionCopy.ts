import type { AppLanguage } from "./language";

/**
 * Localized copy for the single-item review session (saved sentence / saved TOPIK
 * question), keyed by the active app language — same pattern as the other
 * *Copy.ts modules.
 */
export interface ReviewSessionCopy {
  sentenceTitle: string;
  questionTitle: string;
  restart: string;
  listenAgain: string;
  complete: string;
  rewardTitle: string;
  rewardSubtitle: string;
  confirm: string;
  closeA11y: string;
  rewardA11y: (points: number) => string;
  reviewSentenceA11y: string;
  reviewQuestionA11y: string;
  startError: string;
  loadError: string;
}

export const REVIEW_SESSION_COPY: Record<AppLanguage, ReviewSessionCopy> = {
  ko: {
    sentenceTitle: "저장한 문장",
    questionTitle: "저장한 문제",
    restart: "다시 시작",
    listenAgain: "다시 듣기",
    complete: "완료",
    rewardTitle: "복습 완료!",
    rewardSubtitle: "확실히 익히고, 포인트까지",
    confirm: "확인",
    closeA11y: "복습 완료 창 닫기",
    rewardA11y: (points) => `복습을 완료하고 ${points}포인트를 획득했어요.`,
    reviewSentenceA11y: "이 문장 복습하기",
    reviewQuestionA11y: "이 문제 복습하기",
    startError: "복습을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
    loadError: "복습할 내용을 불러오지 못했어요.",
  },
  en: {
    sentenceTitle: "Saved sentence",
    questionTitle: "Saved question",
    restart: "Start over",
    listenAgain: "Listen again",
    complete: "Done",
    rewardTitle: "Review complete!",
    rewardSubtitle: "Nail it down — and earn points too",
    confirm: "Confirm",
    closeA11y: "Close review complete dialog",
    rewardA11y: (points) => `Review complete. You earned ${points} points.`,
    reviewSentenceA11y: "Review this sentence",
    reviewQuestionA11y: "Review this question",
    startError: "Couldn't start the review. Please try again shortly.",
    loadError: "Couldn't load the review content.",
  },
};
