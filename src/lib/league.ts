/**
 * Single source of truth for the league tier ladder — kept in sync with the
 * backend order (green → golden) so the progress carousel and the frontend
 * never disagree on ordering.
 */
export type LeagueTier = "green" | "lime" | "yellow" | "orange" | "golden";

export const LEAGUE_TIERS: LeagueTier[] = ["green", "lime", "yellow", "orange", "golden"];

export const TIER_META: Record<LeagueTier, { label: string; color: string }> = {
  green: { label: "Green 리그", color: "#57b65a" },
  lime: { label: "Lime 리그", color: "#9ad13f" },
  yellow: { label: "Yellow 리그", color: "#f4c72a" },
  orange: { label: "Orange 리그", color: "#ff8f2c" },
  golden: { label: "Golden 리그", color: "#e6ad1f" },
};

/** Short English tier name (no " 리그" suffix) for the guide's tier ladder. */
export function tierName(tier: LeagueTier): string {
  return TIER_META[tier].label.replace(" 리그", "");
}

/**
 * Citrus-badge palette per tier for the guide's fruit icons: `rind` (thick
 * outline) / `fill` (body) / `flesh` (segmented interior). Colours follow the
 * reference identity (green→turquoise, lime→bright lime, … golden→amber).
 */
export const TIER_CITRUS: Record<LeagueTier, { rind: string; fill: string; flesh: string }> = {
  green: { rind: "#2fa383", fill: "#4fc4a1", flesh: "#d7f6ec" },
  lime: { rind: "#8cbb22", fill: "#c2e236", flesh: "#f0fbca" },
  yellow: { rind: "#e7a70c", fill: "#ffcf3a", flesh: "#fff1bf" },
  orange: { rind: "#e2660f", fill: "#ff8f2c", flesh: "#ffdcc2" },
  golden: { rind: "#c88d0e", fill: "#f2b527", flesh: "#ffedbc" },
};

/** Boundary notes shown under the first / last tier in the ladder. */
export const LEAGUE_TIER_NOTES: Partial<Record<LeagueTier, string>> = {
  green: "(강등 없음)",
  golden: "(승급 없음)",
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
 * bounds and `PROMOTE_CUTOFF_RANK` (top 20%) with the green floor / golden
 * ceiling guards in `close_season`.
 */
export type RewardIconKind = "attendance" | "learning" | "course" | "review";

export interface LeaguePointRule {
  id: RewardIconKind;
  label: string;
  points: string;
  details: string[];
  /** Screen-reader announcement (name, base points, bonus rule). */
  aria: string;
}

export const LEAGUE_POINT_RULES: LeaguePointRule[] = [
  { id: "attendance", label: "출석", points: "5P", details: ["7일 연속 출석 시 +10P"], aria: "출석, 5포인트, 7일 연속 출석 시 10포인트 추가" },
  { id: "learning", label: "맞춤 학습", points: "10P", details: ["문장/문제당 +10P", "레벨 클리어 시 +100P"], aria: "맞춤 학습, 10포인트, 문장 또는 문제당 10포인트, 레벨 클리어 시 100포인트" },
  { id: "course", label: "강의", points: "100P", details: ["강의 전체 시청 완료 시 +100P"], aria: "강의, 100포인트, 강의 전체 시청 완료 시 100포인트" },
  { id: "review", label: "복습", points: "5P", details: ["저장한 문장/문제 복습 완료 시 +5P"], aria: "복습, 5포인트, 저장한 문장 또는 문제 복습 완료 시 5포인트" },
];

/** Hero intro copy (4 lines) shown under the guide title. */
export const LEAGUE_INTRO_LINES = [
  "전 세계 학습자들과 경쟁하며",
  "한국어 실력을 키워보세요",
  "공부할수록 점수와 순위가 오르고",
  "도전할수록 더 빠르게 성장할 수 있어요",
];

/** Weekly season bounds (America/New_York, per `_season_bounds_for`). */
export const LEAGUE_SCHEDULE = {
  rangeLabel: "매주 월요일 00:00 시작 ~ 일요일 21:00 종료",
  announceLabel: "(일요일 21시에 결과 발표)",
  timezoneNote: "* 리그 운영 시간은 미국 동부 시간(ET) 기준",
};

/** Promotion policy: top 20% promote; Green cannot demote, Golden cannot promote. */
export const LEAGUE_PROMOTION = {
  headline: "상위 20%만 다음 리그로 승급",
  aria: "상위 20%만 다음 리그로 승급, Green 리그는 강등 없음, Golden 리그는 승급 없음",
};
