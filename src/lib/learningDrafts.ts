import { clearConversationSession } from "./conversationSessionSnapshot";
import { clearTopikSession } from "./topikSessionSnapshot";

/** sessionStorage prefix of a saved-question review's draft, by quiz id. */
export const QUIZ_REVIEW_DRAFT_PREFIX = "hangyul.review.quiz.";

/**
 * Forget every in-progress study snapshot and draft kept in this tab — on
 * sign-out, so the next account in the same tab never resumes the previous
 * one's set or sees their typed answers (a TOPIK essay included).
 */
export function clearLearningDrafts(): void {
  clearConversationSession();
  clearTopikSession();
  try {
    const drafts: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(QUIZ_REVIEW_DRAFT_PREFIX)) drafts.push(key);
    }
    for (const key of drafts) sessionStorage.removeItem(key);
  } catch {
    /* storage unavailable: nothing was kept */
  }
}
