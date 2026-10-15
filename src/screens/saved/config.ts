import type { TranslationKey, Translate } from "../../i18n";
import { uniqueBy } from "../../lib/collections";
import type { Quiz, SavedSentenceItem } from "../../lib/types";
import type { SavedSource, SavedTab } from "../../lib/savedReturn";

/** A row of the feed: a saved sentence or a saved question. */
export type SavedItem = SavedSentenceItem | Quiz;

/* ------------------------------- config -------------------------------- */
// Shared with the review sessions so the tab a session must return to cannot
// drift from the tab this screen renders.
export type Mode = SavedTab;
export type Source = SavedSource;
export type Sort = "latest" | "most_wrong" | "least_reviewed";
export type Skill = "all" | "reading" | "listening" | "writing";
export type MoreState = "idle" | "loading" | "error" | "done";
export type FeedStatus = "loading" | "ready" | "error";

/* -------------------------- return-state cache -------------------------- */
// The screen unmounts when the user opens a saved question for review, so its
// loaded pages / scroll position would otherwise be lost. We snapshot the full
// feed into a module-level cache when navigating into a quiz, tagged with the
// /saved history entry's `loc.key` and the owning user. On the way back
// (`nav(-1)` returns to that same history entry → same key), the snapshot is
// restored verbatim; a fresh open from Home pushes a NEW history entry with a
// different key, so it starts clean. The user tag guards against account
// switches reusing a stale snapshot.
export type SavedSnapshot = {
  userId: string | null;
  locKey: string;
  mode: Mode;
  source: Source;
  sort: Sort;
  skill: Skill;
  query: string;
  dq: string;
  items: SavedItem[];
  cursor: string | null;
  more: MoreState;
  status: FeedStatus;
  scrollTop: number;
};
let savedSnapshot: SavedSnapshot | null = null;

/** The snapshot left for the history entry `locKey` by `userId`, if any. */
export function resumableSnapshot(locKey: string, userId: string | null): SavedSnapshot | null {
  const cached = savedSnapshot;
  return cached && cached.locKey === locKey && cached.userId === userId ? cached : null;
}

/** Keep the feed for the way back from a review. */
export function keepSnapshot(snapshot: SavedSnapshot) {
  savedSnapshot = snapshot;
}

export const SORT_LABEL_KEYS: Record<Sort, TranslationKey> = {
  latest: "saved.sortRecent",
  most_wrong: "saved.sortMostWrong",
  least_reviewed: "saved.sortLeastRecent",
};
export const SENT_SORT: Record<Sort, string> = { latest: "latest", most_wrong: "most_wrong", least_reviewed: "least_recently_viewed" };
export const QUIZ_SORT: Record<Sort, string> = { latest: "recent", most_wrong: "most_incorrect", least_reviewed: "longest_not_reviewed" };
export const SKILLS: { v: Skill; l: TranslationKey }[] = [
  { v: "all", l: "saved.filterAll" },
  { v: "reading", l: "saved.filterReading" },
  { v: "listening", l: "saved.filterListening" },
  { v: "writing", l: "saved.filterWriting" },
];
const SKILL_LABEL_KEYS: Record<string, TranslationKey> = {
  reading: "saved.filterReading",
  listening: "saved.filterListening",
  writing: "saved.filterWriting",
};

export const modeTitleKey = (m: Mode): TranslationKey =>
  m === "sentence" ? "saved.savedSentences" : "saved.savedQuestions";
export const isSentence = (it: SavedSentenceItem | Quiz): it is SavedSentenceItem => "sentence_id" in it;
export const itemId = (it: SavedSentenceItem | Quiz) => (isSentence(it) ? it.sentence_id : it.quiz_id);
/** "[TOPIK 3급 · 읽기]" — the section in the app language. `topik_question_type`
 * is a raw taxonomy code (`reading_03`), never display text. */
export function quizTitle(
  q: Quiz,
  t: Translate,
): string {
  const skillKey = q.topik_section ? SKILL_LABEL_KEYS[q.topik_section] : undefined;
  return t("saved.quizTitle", { level: q.level, skill: skillKey ? ` · ${t(skillKey)}` : "" });
}
/** A page appended to the feed never repeats an item already in it. */
export const dedup = (list: SavedItem[]): SavedItem[] => uniqueBy(list, itemId);
