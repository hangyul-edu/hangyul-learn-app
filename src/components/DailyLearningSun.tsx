import { useQuery } from "@tanstack/react-query";
import { useTranslation, type TranslationKey } from "../i18n";

import { dashboardApi } from "../api/endpoints";
import { SunIcon } from "./brand/HomeIcons";

/**
 * A11y copy for the sun. Kept in one place so the label stays consistent across
 * every render site. (These are i18n catalog keys; callers translate with `t()`.)
 */
export const SUN_COPY_KEYS = {
  lit: "misc.sunStudied",
  unlit: "misc.sunNotStudied",
  loading: "misc.sunLoading",
} as const satisfies Record<string, TranslationKey>;

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
  const { t } = useTranslation();
  const { data, isPending } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const studied = data?.studied_today ?? false;
  return (
    <span
      role="img"
      aria-label={isPending ? t(SUN_COPY_KEYS.loading) : studied ? t(SUN_COPY_KEYS.lit) : t(SUN_COPY_KEYS.unlit)}
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
