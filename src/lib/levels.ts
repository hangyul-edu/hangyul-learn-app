/**
 * The two learning-difficulty scales — the frontend mirror of
 * `src/common/domain/levels.py`.
 *
 * Conversation (회화) runs a 1..10 curriculum scale; TOPIK runs the 1..6 exam
 * 급수 (TOPIK I = 1-2, TOPIK II = 3-6). Both are carried in a field named
 * `level`, which is exactly why every selector must name the scale it means
 * instead of inlining a range — the admin sentence and quiz screens had each
 * other's bounds before these constants existed.
 */

export const CONVERSATION_LEVEL_MIN = 1;
export const CONVERSATION_LEVEL_MAX = 10;

export const TOPIK_GRADE_MIN = 1;
export const TOPIK_GRADE_MAX = 6;

function range(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/** [1..10] — conversation/sentence-catalog levels. */
export const CONVERSATION_LEVELS: number[] = range(
  CONVERSATION_LEVEL_MIN,
  CONVERSATION_LEVEL_MAX,
);

/** [1..6] — TOPIK 급수. */
export const TOPIK_GRADES: number[] = range(TOPIK_GRADE_MIN, TOPIK_GRADE_MAX);
