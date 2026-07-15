import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/kit";
import { gameApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { LeagueLifecycleResponse } from "../lib/types";

/* --------------------------- lifecycle hook ----------------------------- */
export const LIFECYCLE_KEY = ["league-lifecycle"] as const;

/** Server-authoritative League entry state. Polls only while WAITING and
 *  refetches when the app returns to the foreground so the preparing modal
 *  swaps to the new-league modal the moment the backend reports availability. */
export function useLeagueLifecycle() {
  const query = useQuery({
    queryKey: LIFECYCLE_KEY,
    queryFn: gameApi.leagueLifecycle,
    refetchInterval: (q) =>
      q.state.data?.state === "RESULT_VIEWED_WAITING_NEXT_LEAGUE" ? 60_000 : false,
  });
  const waiting = query.data?.state === "RESULT_VIEWED_WAITING_NEXT_LEAGUE";
  const refetch = query.refetch;
  useEffect(() => {
    if (!waiting) return;
    const onForeground = () => {
      if (!document.hidden) void refetch();
    };
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    return () => {
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
    };
  }, [waiting, refetch]);
  return query;
}

/* -------------------------------- icons --------------------------------- */
function MegaphoneIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M9 20v8a3 3 0 0 0 3 3h2l2 9h5l-2-9 17 6a2 2 0 0 0 2.7-1.9V16.9A2 2 0 0 0 38 15L21 21h-9a3 3 0 0 0-3 3z" fill="#ffb020" />
      <path d="M9 20v8a3 3 0 0 0 3 3h9V21h-9a3 3 0 0 0-3 3z" fill="#ff8f2c" />
      <path d="M40 22c2 .6 3 1.9 3 3.6s-1 3-3 3.6" stroke="#ff8f2c" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function ToolsIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M20 14a7 7 0 0 0-9.2 8.6l-4.2 4.2a3 3 0 0 0 0 4.2l2.4 2.4a3 3 0 0 0 4.2 0l4.2-4.2A7 7 0 0 0 30 20l-4.8 4.8-3-3L27 17z" fill="#b8c0c8" />
      <path d="M30 28l8 8a3 3 0 0 1-4.2 4.2l-8-8" stroke="#9aa4ad" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------ modal shell ----------------------------- */
/**
 * Full-screen dimmed overlay + centered white card. Blocks background gestures
 * (backdrop swallows clicks), traps focus, and restores focus on close. None of
 * the lifecycle modals dismiss on backdrop/Escape — they only advance via their
 * action (the preparing modal has no action at all).
 */
function LifecycleModalShell({
  labelledBy,
  describedBy,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move screen-reader focus into the modal.
    const focusable = cardRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? cardRef.current)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Lifecycle modals are not Escape-dismissible.
        event.stopPropagation();
        event.preventDefault();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = cardRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes || nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="llc" role="presentation">
      <div
        className="llc__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        ref={cardRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------- new league started --------------------------- */
export function NewLeagueModal() {
  const qc = useQueryClient();
  const toast = useToast();
  const join = useMutation({
    mutationFn: gameApi.joinCurrentLeague,
    onSuccess: (next) => {
      // Atomic transition — seed the new state so no stale modal flashes.
      qc.setQueryData(LIFECYCLE_KEY, next);
      qc.invalidateQueries({ queryKey: ["league-me"] });
      qc.invalidateQueries({ queryKey: ["league-season"] });
      qc.invalidateQueries({ queryKey: ["league-rankings"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // Reconcile in case the server actually completed the join.
      qc.invalidateQueries({ queryKey: LIFECYCLE_KEY });
    },
  });
  return (
    <LifecycleModalShell labelledBy="llc-new-title" describedBy="llc-new-desc">
      <div className="llc__icon llc__icon--brand">
        <MegaphoneIcon />
      </div>
      <h2 className="llc__title" id="llc-new-title">
        리그가 시작됐어요!
      </h2>
      <p className="llc__desc" id="llc-new-desc">
        지금부터 학습하면 순위가 바로 반영돼요
      </p>
      <Button
        block
        loading={join.isPending}
        onClick={() => join.mutate()}
        aria-label="바로 참여하기"
      >
        바로 참여하기
      </Button>
    </LifecycleModalShell>
  );
}

/* ------------------------ previous result prompt ------------------------ */
export function PreviousResultModal() {
  const nav = useNavigate();
  return (
    <LifecycleModalShell labelledBy="llc-prev-title" describedBy="llc-prev-desc">
      <div className="llc__icon llc__icon--brand">
        <MegaphoneIcon />
      </div>
      <h2 className="llc__title" id="llc-prev-title">
        지난 리그가 마무리됐어요!
      </h2>
      <p className="llc__desc" id="llc-prev-desc">
        지금 바로 결과를 확인해 보세요
      </p>
      <Button block onClick={() => nav("/league/result")} aria-label="결과 보러가기">
        결과 보러가기
      </Button>
    </LifecycleModalShell>
  );
}

/* --------------------------- next league prep --------------------------- */
/** Human, dynamic next-start copy. The league boundary is authoritatively US
 *  Eastern (system-wide rule); it is shown converted to KST per the reference. */
export function formatNextStart(iso: string | null): string {
  if (!iso) return "곧 시작됩니다";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "곧 시작됩니다";
  const day = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/^24/, "00");
  return `${day} ${time}(KST)에 시작됩니다`;
}

export function PreparingModal({ nextStartsAt }: { nextStartsAt: string | null }) {
  return (
    <LifecycleModalShell labelledBy="llc-prep-title" describedBy="llc-prep-desc">
      <div className="llc__icon llc__icon--muted">
        <ToolsIcon />
      </div>
      <h2 className="llc__title" id="llc-prep-title">
        다음 리그를 준비 중이에요!
      </h2>
      <p className="llc__desc" id="llc-prep-desc">
        {formatNextStart(nextStartsAt)}
      </p>
      {/* Non-dismissible: no button, no close affordance. It disappears only
          when the backend reports the next league is available. */}
      <p className="llc__hint" aria-live="polite">
        다음 리그가 열리면 자동으로 안내해 드려요
      </p>
    </LifecycleModalShell>
  );
}

/* ------------------------------ dispatcher ------------------------------ */
/** Renders exactly one lifecycle modal (or none) for the given server state. */
export function LeagueLifecycleModal({ lifecycle }: { lifecycle: LeagueLifecycleResponse }) {
  switch (lifecycle.state) {
    case "RESULT_UNVIEWED":
      return <PreviousResultModal />;
    case "RESULT_VIEWED_WAITING_NEXT_LEAGUE":
      return <PreparingModal nextStartsAt={lifecycle.next_season_starts_at} />;
    case "NEW_LEAGUE_AVAILABLE_NOT_JOINED":
      return <NewLeagueModal />;
    default:
      return null; // ACTIVE_LEAGUE / NO_ELIGIBLE_LEAGUE → normal screen
  }
}
