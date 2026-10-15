import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "../lib/http";
import { dashboardApi, settingsApi, subApi } from "./endpoints";

/**
 * Queries several screens read, declared once so their cache keys and options
 * stay in step (an invalidation by key reaches every reader).
 */

/** Today's dashboard: tracks and goals, streak flags, premium access. */
export function useDashboard({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary, enabled });
}

/** Whether any notification is unread (the bell's dot). */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => http.get<{ has_unread: boolean }>("/notifications/unread"),
    staleTime: 30_000,
  });
}

/** The member's subscription (null when there is none). */
export function useMySubscription() {
  return useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
}

/** Per-track learning preferences (level, daily goal, order). */
export function useLearningPrefs() {
  return useQuery({ queryKey: ["learning-prefs"], queryFn: settingsApi.learning });
}

/** The friend lists Social and the friend league read. */
export const SOCIAL_KEYS = {
  friends: ["friends"],
  received: ["friend-requests-received"],
  sent: ["friend-requests-sent"],
} as const;

/** After a friend action: every Friend-Management + Friend-League surface. */
export function useRefreshSocial() {
  const qc = useQueryClient();
  return () =>
    [SOCIAL_KEYS.friends, SOCIAL_KEYS.received, SOCIAL_KEYS.sent, ["league-rankings"]].forEach((key) =>
      qc.invalidateQueries({ queryKey: key }),
    );
}
