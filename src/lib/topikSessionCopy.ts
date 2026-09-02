import { useTranslation } from "../i18n";
import type { TranslationKey } from "../i18n";

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/**
 * Pure builder over the `topikSession.*` catalog entries. Exported separately
 * from the hook so tests (and any non-component caller) can build the copy for
 * a specific language without a React tree.
 */
export function buildTopikSessionCopy(t: Translate) {
  return {
    title: t("topikSession.title"),
    submit: t("topikSession.submit"),
    next: t("topikSession.next"),
    complete: t("topikSession.complete"),
    resultCorrectTitle: t("topikSession.resultCorrectTitle"),
    resultRetryTitle: t("topikSession.resultRetryTitle"),
    audioTrack: t("topikSession.audioTrack"),
    answerPlaceholder: t("topikSession.answerPlaceholder"),
    blankPlaceholder: t("topikSession.blankPlaceholder"),
    charCount: (current: number, max: number) => t("topikSession.charCount", { current, max }),
    minLengthHint: (min: number) => t("topikSession.minLengthHint", { min }),
    overMaxHint: (max: number) => t("topikSession.overMaxHint", { max }),
    correct: t("topikSession.correct"),
    incorrect: t("topikSession.incorrect"),
    correctAnswerLabel: (answer: string) => t("topikSession.correctAnswerLabel", { answer }),
    scoreLabel: (score: number, max: number) => t("topikSession.scoreLabel", { score, max }),
    suggestionsTitle: t("topikSession.suggestionsTitle"),
    grammarTitle: t("topikSession.grammarTitle"),
    correctedTitle: t("topikSession.correctedTitle"),
    awaitingReview: t("topikSession.awaitingReview"),
    unsupported: t("topikSession.unsupported"),
    saveQuestion: t("topikSession.saveQuestion"),
    removeSaved: t("topikSession.removeSaved"),
    audioPlay: t("topikSession.audioPlay"),
    audioPause: t("topikSession.audioPause"),
    audioLoading: t("topikSession.audioLoading"),
    audioError: t("topikSession.audioError"),
    scoreA11y: (percent: number) => t("topikSession.scoreA11y", { percent }),
  };
}

/** TOPIK session copy, bound to the active language. */
export function useTopikSessionCopy(): TopikSessionCopy {
  const { t } = useTranslation();
  return buildTopikSessionCopy(t);
}

export type TopikSessionCopy = ReturnType<typeof buildTopikSessionCopy>;
