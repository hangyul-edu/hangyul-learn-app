import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import icMegaphone from "../assets/brand/ic-megaphone.svg";
import imgPreparing from "../assets/brand/llc-preparing.png";
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
/* 380:6284 / 784:57725 "📣 메가폰", composed from its three exported vectors.
 * The started and ended modals share it at different sizes. */
function MegaphoneIcon() {
  return <img className="llc__icon" src={icMegaphone} alt="" aria-hidden="true" />;
}

/* 784:57733 "설치 아이콘" — the waiting modal has its own raster illustration,
 * not the megaphone. */
function PreparingIcon() {
  return <img className="llc__icon" src={imgPreparing} alt="" aria-hidden="true" />;
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
  variant,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  variant?: "end" | "wait";
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
        className={`llc__card ${variant ? `llc__card--${variant}` : ""}`}
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
  const { t } = useTranslation();
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
      <MegaphoneIcon />
      <div className="llc__text">
        <h2 className="llc__title" id="llc-new-title">
          {t("leagueLifecycle.startedTitle")}
        </h2>
        <p className="llc__desc" id="llc-new-desc">
          {t("leagueLifecycle.startedDesc")}
        </p>
      </div>
      <button
        className="llc__cta"
        disabled={join.isPending}
        onClick={() => join.mutate()}
        aria-label={t("leagueLifecycle.join")}
      >
        {join.isPending ? (
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
        ) : (
          t("leagueLifecycle.join")
        )}
      </button>
    </LifecycleModalShell>
  );
}

/* ------------------------ previous result prompt ------------------------ */
export function PreviousResultModal() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <LifecycleModalShell labelledBy="llc-prev-title" describedBy="llc-prev-desc" variant="end">
      <MegaphoneIcon />
      <div className="llc__text">
        <h2 className="llc__title" id="llc-prev-title">
          {t("leagueLifecycle.finishedTitle")}
        </h2>
        <p className="llc__desc" id="llc-prev-desc">
          {t("leagueLifecycle.finishedDesc")}
        </p>
      </div>
      <button
        className="llc__cta"
        onClick={() => nav("/league/result")}
        aria-label={t("leagueLifecycle.seeResult")}
      >
        {t("leagueLifecycle.seeResult")}
      </button>
    </LifecycleModalShell>
  );
}

/* --------------------------- next league prep --------------------------- */
/** Human, dynamic next-start copy. The league boundary is authoritatively US
 *  Eastern, and 784:57731 states it that way — "Starts Monday at 00:00(ET)" —
 *  so it is rendered in ET rather than converted to KST. LEG-004's footnote
 *  ("리그 운영 시간은 미국 동부 시간(ET) 기준") says the same. */
export function formatNextStart(
  iso: string | null,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  locale = "ko-KR",
): string {
  if (!iso) return t("leagueLifecycle.startingSoon");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("leagueLifecycle.startingSoon");
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "America/New_York",
    weekday: "long",
  }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/^24/, "00");
  return t("leagueLifecycle.startsAt", { day, time });
}

export function PreparingModal({ nextStartsAt }: { nextStartsAt: string | null }) {
  const { t, language } = useTranslation();
  return (
    /* Non-dismissible: no button, no close affordance — 784:57731 draws none
       either. It disappears only when the backend reports availability. */
    <LifecycleModalShell labelledBy="llc-prep-title" describedBy="llc-prep-desc" variant="wait">
      <PreparingIcon />
      <div className="llc__text">
        <h2 className="llc__title" id="llc-prep-title">
          {t("leagueLifecycle.preparingTitle")}
        </h2>
        <p className="llc__desc" id="llc-prep-desc" aria-live="polite">
          {formatNextStart(nextStartsAt, t, language === "ko" ? "ko-KR" : "en-US")}
        </p>
      </div>
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
