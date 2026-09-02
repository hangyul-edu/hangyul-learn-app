import type { TranslationKey } from "../i18n";
/**
 * Presentation helpers for the Notifications screen.
 *
 * Timestamps are stored UTC; grouping and relative labels are computed in the
 * user's local timezone (the browser's) so "오늘 / 어제 / M월 D일" match the
 * user's calendar, not the server's.
 */
import type { NotificationGroup } from "./types";

/** Number of whole local-calendar days between two instants (b - a). */
function dayDelta(a: Date, b: Date): number {
  const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((startB.getTime() - startA.getTime()) / 86_400_000);
}

/** Stable bucket key for a notification's date (for grouping/merging). */
export function bucketKey(createdAt: string, now: Date = new Date()): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "unknown";
  const delta = dayDelta(d, now);
  if (delta <= 0) return "today";
  if (delta === 1) return "yesterday";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Formats a message from the active catalog; supplied by the caller's `t`. */
type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Date heading for a group (today / yesterday / M-D, with the year when needed). */
export function bucketLabel(createdAt: string, t: Translate, now: Date = new Date()): string {
  const key = bucketKey(createdAt, now);
  if (key === "today") return t("notifications.today");
  if (key === "yesterday") return t("notifications.yesterday");
  const d = new Date(createdAt);
  return d.getFullYear() === now.getFullYear()
    ? t("notifications.monthDay", { m: d.getMonth() + 1, d: d.getDate() })
    : t("notifications.yearMonthDay", {
        y: d.getFullYear(),
        m: d.getMonth() + 1,
        d: d.getDate(),
      });
}

/** Compact relative time: just now / N min / N hr / yesterday / M-D. */
export function relativeTime(createdAt: string, t: Translate, now: Date = new Date()): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return t("notifications.justNow");
  const mins = Math.floor(secs / 60);
  if (mins < 60) return t("notifications.minutesAgo", { n: mins });
  const delta = dayDelta(d, now);
  if (delta <= 0) return t("notifications.hoursAgo", { n: Math.floor(mins / 60) });
  if (delta === 1) return t("notifications.yesterday");
  return bucketLabel(createdAt, t, now);
}

export const GROUP_LABEL_KEYS: Record<NotificationGroup, TranslationKey> = {
  learning: "notifications.learning",
  announcement: "notifications.notice",
  social: "notifications.social",
};
