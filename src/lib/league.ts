import type { TranslationKey } from "../i18n";
/**
 * Single source of truth for the league tier ladder — kept in sync with the
 * backend order (green → golden) so the progress carousel and the frontend
 * never disagree on ordering.
 */
export type LeagueTier = "green" | "lime" | "yellow" | "orange" | "golden";

export const LEAGUE_TIERS: LeagueTier[] = ["green", "lime", "yellow", "orange", "golden"];

/**
 * Tier identity. The tier *name* is a proper noun and identical in both
 * languages; only the surrounding word differs ("Green 리그" / "Green League",
 * Figma LEG-002 1423:22087), so the suffix lives in the catalogs as
 * `league.tierLabel` and callers compose it.
 */
export const TIER_META: Record<LeagueTier, { name: string; color: string }> = {
  green: { name: "Green", color: "#57b65a" },
  lime: { name: "Lime", color: "#9ad13f" },
  yellow: { name: "Yellow", color: "#ffc41f" },
  orange: { name: "Orange", color: "#ff8f2c" },
  golden: { name: "Golden", color: "#e6ad1f" },
};

/** Short tier name (no "League"/"리그" suffix) for the guide's tier ladder. */
export function tierName(tier: LeagueTier): string {
  return TIER_META[tier].name;
}

/** Boundary notes shown under the first / last tier in the ladder. */
export const LEAGUE_TIER_NOTE_KEYS: Partial<Record<LeagueTier, TranslationKey>> = {
  green: "league.noDemotion",
  golden: "league.noPromotion",
};

/** Order index of a tier (−1 if unknown). Drives colored-vs-locked in the carousel. */
export function tierIndex(tier: string | null | undefined): number {
  return LEAGUE_TIERS.indexOf(tier as LeagueTier);
}

/**
 * Single source of truth for the League-guide policy copy. The reward values
 * mirror the backend `POINT_RULES` (attendance 5 / streak +10, customized
 * learning 10 / level-clear +100, course 100, review 5) so the guide never
 * drifts from real scoring; the schedule + promotion rules mirror the season
 * bounds and `PROMOTION_SHARE` (top 20%) with the green floor / golden
 * ceiling guards in `league_cutoffs`.
 */
export type RewardIconKind = "attendance" | "learning" | "course" | "review";

export interface LeaguePointRule {
  id: RewardIconKind;
  label: TranslationKey;
  /** Point values are numerals with a "P" suffix — identical in both languages. */
  points: string;
  details: TranslationKey[];
  /** Screen-reader announcement (name, base points, bonus rule). */
  aria: TranslationKey;
}

export const LEAGUE_POINT_RULES: LeaguePointRule[] = [
  {
    id: "attendance",
    label: "league.ruleAttendance",
    points: "5P",
    details: ["league.ruleAttendanceDetail", "league.ruleAttendanceDay"],
    aria: "league.ruleAttendanceAria",
  },
  {
    id: "learning",
    label: "league.ruleLearning",
    points: "10P",
    details: ["league.ruleLearningDetail1", "league.ruleLearningDetail2"],
    aria: "league.ruleLearningAria",
  },
  {
    id: "course",
    label: "league.ruleCourse",
    points: "100P",
    details: ["league.ruleCourseDetail"],
    aria: "league.ruleCourseAria",
  },
  {
    id: "review",
    label: "league.ruleReview",
    points: "5P",
    details: ["league.ruleReviewDetail"],
    aria: "league.ruleReviewAria",
  },
];

/** Hero intro copy (4 lines) shown under the guide title. */
export const LEAGUE_INTRO_LINE_KEYS: TranslationKey[] = [
  "league.intro1",
  "league.intro2",
  "league.intro3",
  "league.intro4",
];

/** Weekly season bounds (America/New_York, per `_season_bounds_for`). */
export const LEAGUE_SCHEDULE_KEYS = {
  rangeLabel: "league.scheduleRange" as TranslationKey,
  announceLabel: "league.scheduleAnnounce" as TranslationKey,
  timezoneNote: "league.scheduleTimezone" as TranslationKey,
};

/** Promotion policy: top 20% promote; Green cannot demote, Golden cannot promote. */
export const LEAGUE_PROMOTION_KEYS = {
  headline: "league.promotionHeadline" as TranslationKey,
  aria: "league.promotionAria" as TranslationKey,
};
