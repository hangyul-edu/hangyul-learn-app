import type { Sentence } from "./types";

/**
 * The in-progress conversation session, persisted so a refresh resumes instead
 * of requesting brand-new content.
 *
 * Scoped to the browser tab via sessionStorage and cleared when the session is
 * finished or exited. Only durable progress is stored — transient attempt state
 * (typed text, recording, the last result) is deliberately left out, so a
 * refresh resumes at the current item with a clean slate.
 */
export type ConversationSessionSnapshot = {
  items: Sentence[];
  idx: number;
  points: number;
  correct: string[];
  answered: string[];
  saved: Record<string, boolean>;
  revealed: Record<string, string>;
  hintStage: Record<string, "hint" | "answer">;
  prompt: string;
  startedAt: number;
  keyboard: boolean;
  /** Additional-learning batch size (5/10/15/20), or null for a normal session. */
  additionalCount: number | null;
};

const STORAGE_KEY = "hangyul.session.conversation.v1";

/** The saved session, or null when there is nothing usable to resume. */
export function readConversationSession(): ConversationSessionSnapshot | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const snapshot = JSON.parse(stored) as ConversationSessionSnapshot;
    return Array.isArray(snapshot.items) && snapshot.items.length > 0 ? snapshot : null;
  } catch {
    return null;
  }
}

export function saveConversationSession(snapshot: ConversationSessionSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota / serialization errors — persistence is best-effort */
  }
}

export function clearConversationSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
