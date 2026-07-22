import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../api/endpoints";
import { SunIcon } from "./brand/HomeIcons";

/**
 * A11y copy for the sun. Kept in one place so the label stays consistent across
 * every render site. (The app chrome uses Korean literals; there is no i18n
 * framework yet — swap these for message keys when one lands.)
 */
export const SUN_COPY = {
  lit: "오늘 학습을 시작했어요",
  unlit: "오늘 아직 학습하지 않았어요",
  loading: "학습 현황을 불러오는 중",
} as const;

/**
 * The single, server-backed daily-learning sun. Every mounted instance reads the
 * shared ["dashboard"] query, so when `studied_today` flips (e.g. after the first
 * qualifying view records an activity) all suns across the app re-render together
 * — one source of truth, no page-local state.
 *
 * While the summary is first loading (no cached value yet) the sun renders dimmed
 * rather than a confident OFF, so a cold start doesn't flash gray → lit.
 */
export function DailyLearningSun({ size }: { size?: number }) {
  const { data, isPending } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const studied = data?.studied_today ?? false;
  return (
    <span
      role="img"
      aria-label={isPending ? SUN_COPY.loading : studied ? SUN_COPY.lit : SUN_COPY.unlit}
      style={{
        // inline-flex so the SVG centers on the flex cross-axis instead of
        // sitting on the text baseline (which nudged the sun above the number).
        display: "inline-flex",
        alignItems: "center",
        transition: "opacity 150ms ease",
        opacity: isPending ? 0.5 : 1,
      }}
    >
      <SunIcon size={size} lit={studied} />
    </span>
  );
}
