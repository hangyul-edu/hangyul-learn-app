import { createSessionSnapshotStore } from "./sessionSnapshot";
import type { Sentence } from "./types";

/**
 * The in-progress conversation session, persisted so a refresh resumes instead
 * of requesting brand-new content.
 *
 * Only durable progress is stored — transient attempt state (typed text,
 * recording, the last result) is deliberately left out, so a refresh resumes at
 * the current item with a clean slate.
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

const store = createSessionSnapshotStore<ConversationSessionSnapshot>(
  "hangyul.session.conversation.v1",
  (snapshot) => Array.isArray(snapshot.items) && snapshot.items.length > 0,
);

export const readConversationSession = store.read;
export const saveConversationSession = store.save;
export const clearConversationSession = store.clear;
