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

/** Order index of a tier (−1 if unknown). Drives colored-vs-locked in the carousel. */
export function tierIndex(tier: string | null | undefined): number {
  return LEAGUE_TIERS.indexOf(tier as LeagueTier);
}

/** Ranked-list reward policy shown in the league info screen (mirrors the
 *  backend POINT_RULES; kept here for display copy only). */
export const LEAGUE_POINT_RULES = [
  { label: "출석", points: "5P", details: ["7일 연속 출석 시 +10P"] },
  { label: "맞춤 학습", points: "10P", details: ["문장/문제당 +10P", "레벨 클리어 시 +100P"] },
  { label: "강의", points: "100P", details: ["강의 전체 시청 완료 시 +100P"] },
  { label: "복습", points: "5P", details: ["저장한 문장/문제 복습 완료 시 +5P"] },
];
