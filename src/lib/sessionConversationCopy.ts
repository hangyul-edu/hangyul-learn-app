import { useTranslation } from "../i18n";

/**
 * Conversation-session copy, bound to the active language
 * (`sessionConversation.*`) — the incorrect-answer / retry / pronunciation
 * states. No language literals live in the component.
 */
export function useSessionConversationCopy() {
  const { t } = useTranslation();
  return {
    incorrectStatus: t("sessionConversation.incorrectStatus"),
    hint: t("sessionConversation.hint"),
    answer: t("sessionConversation.answer"),
    voiceMode: t("sessionConversation.voiceMode"),
    keyboardMode: t("sessionConversation.keyboardMode"),
    pronunciationTitle: t("sessionConversation.pronunciationTitle"),
    pronunciationFallback: t("sessionConversation.pronunciationFallback"),
    scoreA11y: (percent: number) => t("sessionConversation.scoreA11y", { percent }),
    evaluationError: t("sessionConversation.evaluationError"),
    retryMessage: t("common.networkError"),
    micPermission: t("sessionConversation.micPermission"),
    bookmarkSave: t("sessionConversation.bookmarkSave"),
    bookmarkUnsave: t("sessionConversation.bookmarkUnsave"),
    recordA11y: t("sessionConversation.recordA11y"),
    stopRecordA11y: t("sessionConversation.stopRecordA11y"),
    micRetryA11y: t("sessionConversation.micRetryA11y"),
  };
}

export type SessionConversationCopy = ReturnType<typeof useSessionConversationCopy>;
