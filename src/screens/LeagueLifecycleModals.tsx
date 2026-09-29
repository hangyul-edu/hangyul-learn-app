import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import icMegaphone from "../assets/brand/ic-megaphone.svg";
import imgPreparing from "../assets/brand/llc-preparing.png";
import imgWaiting from "../assets/brand/llc-waiting.svg";
import { gameApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { localeFor } from "../lib/format";
import { errorMessage } from "../lib/http";
import type { LeagueLifecycleResponse } from "../lib/types";

/* --------------------------- lifecycle hook ----------------------------- */
export const LIFECYCLE_KEY = ["league-lifecycle"] as const;

/** Server-authoritative League entry state.
 *
 *  Polls only in `RESULT_VIEWED_WAITING_NEXT_LEAGUE` — the gap between weeks,
 *  which ends at a time the server already knows — and refetches on foreground
 *  so the preparing modal swaps to the new-league modal the moment the backend
 *  reports availability.
 *
 *  `WAITING_FOR_ALLOCATION` is deliberately *not* polled: it ends when other
 *  learners turn up, which no interval can predict, and a member watching that
 *  modal is not waiting on a tick. They are sent Home, and the push that
 *  announces their new league brings them back. */
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

/* 784:57733 "설치 아이콘" — the between-weeks modal has its own raster
 * illustration, not the megaphone. */
function PreparingIcon() {
  return <img className="llc__icon" src={imgPreparing} alt="" aria-hidden="true" />;
}

/* 3453:27285 — an hourglass, drawn for the allocation wait. Deliberately not
 * the preparing illustration: the two states look alike and are not, so they
 * do not get to share a picture. */
function HourglassIcon() {
  return <img className="llc__icon" src={imgWaiting} alt="" aria-hidden="true" />;
}

/* ------------------------------ modal shell ----------------------------- */
/**
 * Full-screen dimmed overlay + centered white card. Blocks background gestures
 * (backdrop swallows clicks), traps focus, and restores focus on close. None of
 * the lifecycle modals dismiss on backdrop/Escape — the only way out is their
 * own button, which either advances the state (join, see result) or leaves for
 * Home when there is nothing the member can do about the wait.
 */
function LifecycleModalShell({
  labelledBy,
  describedBy,
  variant,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  // `wait` is the gap between weeks (217-tall card); `waiting` is waiting to
  // be allocated one (184). One letter apart and not the same thing — check
  // which modal you are in before reusing either.
  variant?: "end" | "wait" | "waiting";
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
function NewLeagueModal() {
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
function PreviousResultModal() {
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
function formatNextStart(
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

function PreparingModal({ nextStartsAt }: { nextStartsAt: string | null }) {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  return (
    /* 3329:37278 (KO) / 3329:37296 (EN). The redraw adds a primary CTA to what
       used to be a dead end: the state itself still clears only when the
       backend reports availability, but the user is no longer trapped on the
       League screen while waiting — they can leave for Home. Backdrop and
       Escape stay inert, so this button is the one way out. */
    <LifecycleModalShell labelledBy="llc-prep-title" describedBy="llc-prep-desc" variant="wait">
      <PreparingIcon />
      <div className="llc__text">
        <h2 className="llc__title" id="llc-prep-title">
          {t("leagueLifecycle.preparingTitle")}
        </h2>
        <p className="llc__desc" id="llc-prep-desc" aria-live="polite">
          {formatNextStart(nextStartsAt, t, localeFor(language))}
        </p>
      </div>
      <button
        className="llc__cta"
        onClick={() => nav("/home")}
        aria-label={t("leagueLifecycle.backToHome")}
      >
        {t("leagueLifecycle.backToHome")}
      </button>
    </LifecycleModalShell>
  );
}

/* ------------------------- waiting for allocation ----------------------- */
/**
 * LEG — 3451:27233 (KO) / 3453:27320 (EN).
 *
 * The member has studied, so they have earned a league; there is simply
 * nowhere to seat them yet, because every league in their tier is full and
 * fewer than five are waiting to open another. Nothing is broken and nothing
 * is required of them, which is the whole point of giving this state its own
 * modal: without one it fell through to the League screen's dormant
 * invitation, telling somebody who had just finished a lesson to go and study.
 *
 * **Not an error.** No error styling, no retry, no apology, and the copy
 * promises the outcome rather than reporting a failure — "함께할 학습자가
 * 모이면 리그가 시작돼요". The one thing that resolves it is other learners
 * arriving, so the only action offered is the way out.
 *
 * Distinct from `PreparingModal` too, which is the *gap between weeks*: that
 * one knows when it ends and says so. This one cannot, so it says what it is
 * waiting for instead of inventing a time.
 */
function WaitingForAllocationModal() {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <LifecycleModalShell
      labelledBy="llc-wait-title"
      describedBy="llc-wait-desc"
      variant="waiting"
    >
      <HourglassIcon />
      <div className="llc__text">
        <h2 className="llc__title" id="llc-wait-title">
          {t("leagueLifecycle.waitingTitle")}
        </h2>
        {/* Announced politely, and as status rather than alert: a screen
            reader must not hear this as something going wrong either. */}
        <p className="llc__desc" id="llc-wait-desc" role="status" aria-live="polite">
          {t("leagueLifecycle.waitingDesc")}
        </p>
      </div>
      <button
        className="llc__cta"
        onClick={() => nav("/home")}
        aria-label={t("leagueLifecycle.backToHome")}
      >
        {t("leagueLifecycle.backToHome")}
      </button>
    </LifecycleModalShell>
  );
}

/* ------------------------------ dispatcher ------------------------------ */
/**
 * Renders exactly one lifecycle modal (or none) for the given server state.
 *
 * The four modals above are deliberately not exported: which one a member sees
 * is the server's decision, so the only supported way to show any of them is
 * to hand this the state and let it choose.
 */
export function LeagueLifecycleModal({ lifecycle }: { lifecycle: LeagueLifecycleResponse }) {
  switch (lifecycle.state) {
    case "RESULT_UNVIEWED":
      return <PreviousResultModal />;
    case "RESULT_VIEWED_WAITING_NEXT_LEAGUE":
      return <PreparingModal nextStartsAt={lifecycle.next_season_starts_at} />;
    case "NEW_LEAGUE_AVAILABLE_NOT_JOINED":
      return <NewLeagueModal />;
    case "WAITING_FOR_ALLOCATION":
      return <WaitingForAllocationModal />;
    default:
      // ACTIVE_LEAGUE / NO_ELIGIBLE_LEAGUE → normal screen. NO_ELIGIBLE_LEAGUE
      // is the member who has not studied; the screen's own invitation is the
      // right thing to show them. WAITING_FOR_ALLOCATION is not that, which
      // is why it is a case above and not part of this default.
      return null;
  }
}
