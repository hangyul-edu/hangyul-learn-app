import type { TranslationKey, Translate } from "../../i18n";
import type { ManagementBucket, ManagementPeriod } from "../../lib/types";

export const PERIODS: { id: ManagementPeriod; label: TranslationKey }[] = [
  { id: "7d", label: "learningManagement.last7" },
  { id: "1m", label: "learningManagement.thisMonth" },
  { id: "3m", label: "learningManagement.last3m" },
  { id: "1y", label: "learningManagement.last1y" },
];

/** Seconds → "HH:MM" (summary card). */
export function fmtHHMM(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}
/** Seconds → compact "1h33m" / "33m" — unspaced, as HMA-002 labels its bar. */
export function fmtShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

/**
 * X-axis label for one bar, derived here rather than taken from the response.
 *
 * The API sends no label: the bucket's dates carry everything needed, so each
 * client formats its own in the app language — and switching language
 * re-renders the axis immediately, with no refetch.
 *
 * `Intl` reproduces both Figma frames exactly: weekday `short` gives 월…일
 * (HMA-002 KO 1:3636) and Mon…Sun (EN 784:50416); month `short` gives 9월 / Sep,
 * the Korean matching what the server used to send. Only the weekly label has no
 * Intl equivalent, so it goes through the catalog.
 */
export function bucketLabel(
  bucket: ManagementBucket,
  period: ManagementPeriod,
  index: number,
  locale: string,
  t: Translate,
): string {
  // Parse at local midnight: a bare "YYYY-MM-DD" is parsed as UTC and would
  // shift to the previous day (and so the previous weekday) west of Greenwich.
  const date = new Date(`${bucket.start_date}T00:00:00`);
  // A malformed date has no formattable label; show the raw value rather than
  // an empty tick, so the axis still lines up with the bars.
  if (Number.isNaN(date.getTime())) return bucket.start_date;
  if (period === "7d") return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  // Buckets arrive chronologically, one per calendar week of the month.
  if (period === "1m") return t("learningManagement.weekLabel", { n: index + 1 });
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}
