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

/** Korean date heading for a group (오늘 / 어제 / M월 D일, with year when needed). */
export function bucketLabel(createdAt: string, now: Date = new Date()): string {
  const key = bucketKey(createdAt, now);
  if (key === "today") return "오늘";
  if (key === "yesterday") return "어제";
  const d = new Date(createdAt);
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}월 ${d.getDate()}일`
    : `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** Compact relative time: 방금 / N분 전 / N시간 전 / 어제 / M월 D일. */
export function relativeTime(createdAt: string, now: Date = new Date()): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (secs < 60) return "방금";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}분 전`;
  const delta = dayDelta(d, now);
  if (delta <= 0) return `${Math.floor(mins / 60)}시간 전`;
  if (delta === 1) return "어제";
  return bucketLabel(createdAt, now);
}

export const GROUP_LABEL: Record<NotificationGroup, string> = {
  learning: "학습",
  announcement: "공지",
  social: "소셜",
};
