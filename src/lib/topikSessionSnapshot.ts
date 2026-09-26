import { createSessionSnapshotStore } from "./sessionSnapshot";
import type { AnswerValue } from "../components/QuestionView";
import type { Quiz, TopikSection } from "./types";

/**
 * The in-progress TOPIK session, persisted so a refresh restores the same set,
 * position, drafts and authoritative progress rather than generating anew.
 */
export type TopikSessionSnapshot = {
  section: TopikSection;
  items: Quiz[];
  idx: number;
  // Per-item working answers keyed by quiz_id (writing drafts, selected option,
  // typed blanks) so nothing is lost across navigation or refresh.
  drafts: Record<string, AnswerValue>;
  correct: string[];
  attempted: string[];
  points: number;
  typeCode: string | null;
  startedAt: number;
  // Server-authoritative daily-goal snapshot (correctly-completed / goal).
  goalCurrent: number;
  goalTarget: number;
  // Additional-learning batch size (5/10/15/20), or null for a normal session.
  additionalCount: number | null;
  // Session id for per-question credit dedup (see learningSessionIdRef) —
  // preserved across a refresh so a retry after refreshing still dedups.
  learningSessionId?: string;
  // Whether the learner is re-solving the set after 다시 시작.
  retrying?: boolean;
  // The adaptive session the set belongs to (its items and progress are
  // resumed from the server); absent/null for a legacy recommendation set.
  studySessionId?: string | null;
};

const store = createSessionSnapshotStore<TopikSessionSnapshot>(
  "hangyul.session.topik.v1",
  (snapshot) => Array.isArray(snapshot.items) && snapshot.items.length > 0,
);

export const readTopikSession = store.read;
export const saveTopikSession = store.save;
export const clearTopikSession = store.clear;
