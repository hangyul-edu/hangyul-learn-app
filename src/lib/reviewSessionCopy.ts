import { useTranslation } from "../i18n";

/** Saved-item review session copy, bound to the active language (`reviewSession.*`). */
export function useReviewSessionCopy() {
  const { t } = useTranslation();
  return {
    sentenceTitle: t("reviewSession.sentenceTitle"),
    questionTitle: t("reviewSession.questionTitle"),
    restart: t("reviewSession.restart"),
    listenAgain: t("reviewSession.listenAgain"),
    complete: t("reviewSession.complete"),
    rewardTitle: t("reviewSession.rewardTitle"),
    rewardSubtitle: t("reviewSession.rewardSubtitle"),
    confirm: t("reviewSession.confirm"),
    closeA11y: t("reviewSession.closeA11y"),
    rewardA11y: (points: number) => t("reviewSession.rewardA11y", { points }),
    reviewSentenceA11y: t("reviewSession.reviewSentenceA11y"),
    reviewQuestionA11y: t("reviewSession.reviewQuestionA11y"),
    startError: t("reviewSession.startError"),
    loadError: t("reviewSession.loadError"),
  };
}

export type ReviewSessionCopy = ReturnType<typeof useReviewSessionCopy>;
