import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Async, ErrorState, LoadingState, SkeletonList } from "../components/ui/states";
import { MedalIcon, RankAvatar, withSelfProfile } from "../components/brand/RankBits";
import { CitrusBadge } from "../components/brand/LeagueGuideArt";
import { gameApi } from "../api/endpoints";
import { LEAGUE_TIERS, TIER_META, tierIndex, type LeagueTier } from "../lib/league";
import type { RankingEntry } from "../lib/types";
import { LeagueLifecycleModal, useLeagueLifecycle } from "./LeagueLifecycleModals";
import { LeagueGuideSheet } from "./LeagueGuide";
import { FriendLeague } from "./FriendLeague";
import { MyPoints } from "./MyPoints";
import { useAuthOptional } from "../hooks/auth";

type Tab = "regular" | "friend" | "points";

/* ------------------------------ helpers -------------------------------- */
/** Remaining time until a season's end (from real backend timing), or null when
 *  it has already elapsed so the caller can show the "ending soon" wording. */
function countdown(endsAt: string, now = Date.now()): { d: number; h: number; m: number } | null {
  const ms = new Date(endsAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return null;
  const mins = Math.floor(ms / 60000);
  return { d: Math.floor(mins / 1440), h: Math.floor((mins % 1440) / 60), m: mins % 60 };
}

/** Official league tier image — colourful citrus for reached tiers, greyed +
 *  padlocked for future ones. */
function LeagueBadge({ tier, reached, current }: { tier: LeagueTier; reached: boolean; current: boolean }) {
  const { t } = useTranslation();
  return (
    <CitrusBadge
      tier={tier}
      locked={!reached}
      className={`lg__badge ${current ? "is-current" : ""}`}
      label={`${t("league.tierLabel", { tier: TIER_META[tier].name })}${
        current ? `, ${t("league.currentLeague")}` : reached ? "" : `, ${t("league.locked")}`
      }`}
    />
  );
}

/* --------------------------- carousel ---------------------------------- */
/**
 * Horizontal ladder of every tier with the user's CURRENT league centered.
 * Reached tiers are colored, future tiers gray + locked. It is a progress
 * visualization, NOT a selector — after any drag/scroll settles it snaps back
 * to re-center the current league, and it never mutates the fixed title/timer.
 */
function LeagueCarousel({ currentTier }: { currentTier: LeagueTier }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curIdx = Math.max(0, tierIndex(currentTier));
  // Which badge is nearest the carousel centre — it scales up ("focused").
  const [focused, setFocused] = useState(curIdx);

  const recenter = (behavior: ScrollBehavior) => {
    const box = scrollRef.current;
    const el = currentRef.current;
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior });
  };

  // Highlight whichever slot's centre is closest to the viewport centre.
  const updateFocused = () => {
    const box = scrollRef.current;
    if (!box) return;
    const center = box.scrollLeft + box.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    slotsRef.current.forEach((el, i) => {
      if (!el) return;
      const distance = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setFocused(nearest);
  };

  // Center the user's current league on mount (no animation — it's the anchor).
  useLayoutEffect(() => {
    recenter("auto");
    updateFocused();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTier]);

  // Recompute focus continuously as the user drags; snap back once it settles.
  const onScroll = () => {
    updateFocused();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => recenter("smooth"), 350);
  };
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  return (
    <div
      className="lg__carousel"
      ref={scrollRef}
      onScroll={onScroll}
      onTouchEnd={() => recenter("smooth")}
      onPointerUp={() => recenter("smooth")}
      aria-label={t("league.progressA11y")}
    >
      <div className="lg__carousel-track">
        {LEAGUE_TIERS.map((tier, i) => (
          <div
            key={tier}
            ref={(el) => {
              slotsRef.current[i] = el;
              if (i === curIdx) currentRef.current = el;
            }}
            className={`lg__badge-slot ${i === curIdx ? "is-current" : ""} ${i === focused ? "is-focused" : ""}`}
            aria-current={i === curIdx ? "true" : undefined}
          >
            <LeagueBadge tier={tier} reached={i <= curIdx} current={i === curIdx} />
          </div>
        ))}
      </div>
    </div>
  );
}


/* --------------------------- ranking list ------------------------------ */
function RankingList({ entries, meId }: { entries: RankingEntry[]; meId?: string }) {
  const { t } = useTranslation();
  // The standings endpoint can lag a profile change, so the signed-in user's own
  // avatar comes from /users/me instead of from their ranking row.
  const me = useAuthOptional()?.me ?? null;
  const meRef = useRef<HTMLLIElement>(null);
  const anchored = useRef(false);
  // Initial scroll anchors around the current user's row (once per fresh load).
  useEffect(() => {
    if (anchored.current || !meRef.current) return;
    anchored.current = true;
    meRef.current.scrollIntoView({ block: "center" });
  }, [entries]);

  return (
    <ul className="lg__ranks" role="list">
      {entries.map((e) => {
        const isMe = e.user_id === meId;
        const medal = e.rank <= 3;
        return (
          <li
            key={e.user_id}
            ref={isMe ? meRef : undefined}
            className={`lg__rank ${isMe ? "is-me" : ""}`}
            aria-current={isMe ? "true" : undefined}
            aria-label={t("league.rankRowA11y", {
              rank: e.rank,
              name: e.nickname ?? t("league.defaultNickname"),
              me: isMe ? t("league.meSuffix") : "",
              points: e.points,
            })}
          >
            <span className="lg__rank-no">{e.rank}</span>
            <RankAvatar entry={withSelfProfile(e, me)} />
            <span className="lg__rank-name">
              {e.nickname ?? t("league.defaultNickname")}
            </span>
            {medal && <MedalIcon rank={e.rank} />}
            <span className="lg__rank-pts">{e.points}P</span>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------- screen ------------------------------- */
export function League() {
  const { t } = useTranslation();
  const nav = useNavigate();
  // Optional deep-link, e.g. `/league?tab=points` (used by the /points route).
  const [params] = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(
    initialTab === "friend" || initialTab === "points" ? initialTab : "regular",
  );
  const [info, setInfo] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Server-authoritative entry lifecycle gates the whole screen: a modal for
  // every state that is not simply "you are in a league". See
  // LeagueLifecycleModals.tsx.
  const lifecycle = useLeagueLifecycle();
  const mine = useQuery({ queryKey: ["league-me"], queryFn: gameApi.myLeague });
  const season = useQuery({ queryKey: ["league-season"], queryFn: gameApi.currentSeason });
  const regular = useQuery({ queryKey: ["league-rankings", "regular"], queryFn: gameApi.currentRankings, enabled: tab === "regular" });

  // Live countdown — re-tick once a minute while the screen is open.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // `dormant` from /leagues/me means "no seat", which is also true of a member
  // waiting for allocation. They never see the invitation below — the
  // lifecycle modal covers the screen for them — so this stays the simple
  // read; the modal is what keeps it from telling a learner who has just
  // studied to go and study.
  const dormant = !!mine.data?.dormant;
  const currentTier = (mine.data?.tier ?? "green") as LeagueTier;

  return (
    <div className={`screen lg lg--${tab}`}>
      <div className="screen__body screen__body--nav lg__body">
        {/* Segmented sub-tabs + history */}
        <div className="lg__tabs">
          <div className="lg__tabset" role="tablist" aria-label={t("league.tablistA11y")}>
            <button role="tab" aria-selected={tab === "regular"} className={`lg__tab ${tab === "regular" ? "is-active" : ""}`} onClick={() => setTab("regular")}>
              {t("league.tabRegular")}
            </button>
            <button role="tab" aria-selected={tab === "friend"} className={`lg__tab ${tab === "friend" ? "is-active" : ""}`} onClick={() => setTab("friend")}>
              {t("league.tabFriends")}
            </button>
            <button role="tab" aria-selected={tab === "points"} className={`lg__tab ${tab === "points" ? "is-active" : ""}`} onClick={() => setTab("points")}>
              {t("league.myPoints")}
            </button>
          </div>
          {tab === "friend" ? (
            <button className="lg__history" onClick={() => nav("/social")} aria-label={t("league.manageFriends")}>
              {t("league.manageFriends")}
            </button>
          ) : (
            <button className="lg__history" onClick={() => nav("/league/history")} aria-label={t("league.historyA11y")}>
              {t("league.history")}
            </button>
          )}
        </div>

        {tab === "points" ? (
          /* My Points: current weekly-league total + month-grouped ledger. */
          <MyPoints />
        ) : tab === "friend" ? (
          /* Friend League has its own podium hero + list; it does not use the
             regular-league lifecycle/carousel. */
          <FriendLeague />
        ) : !lifecycle.data ? (
          /* Wait for the authoritative lifecycle before rendering ranking/empty
             so the correct modal/state shows without flashing the wrong screen. */
          lifecycle.error ? (
            <ErrorState message={t("league.loadError")} onRetry={() => lifecycle.refetch()} />
          ) : (
            <LoadingState />
          )
        ) : (
          <Async
            loading={mine.isLoading}
            error={mine.error}
            data={mine.data}
            onRetry={() => mine.refetch()}
            skeleton={<SkeletonList rows={4} height={64} />}
          >
            {(m) =>
              dormant ? (
                /* LEG-000 (1681:26767) — no illustration and no badge, just the
                   headline over its two-line invitation on a white page. */
                <div className="lg-empty">
                  <h2 className="lg-empty__title">{t("league.noLeague")}</h2>
                  <p className="lg-empty__desc">
                    {t("league.emptyLine1")}
                    <br />
                    {t("league.emptyLine2")}
                  </p>
                </div>
              ) : (
                <>
                  <LeagueCarousel currentTier={currentTier} />
                  <div className="lg__title-row">
                    <span className="lg__title">{TIER_META[currentTier] ? t("league.tierLabel", { tier: TIER_META[currentTier].name }) : m.tier_label}</span>
                    <button className="lg__info-btn" onClick={() => setInfo(true)} aria-label={t("league.openGuide")}>
                      ?
                    </button>
                  </div>
                  {season.data?.ends_at && (
                    <p className="lg__timer">
                      {(() => {
                        const left = countdown(season.data.ends_at, nowTick);
                        return left
                          ? t("league.timeLeft", { time: t("league.countdown", left) })
                          : t("league.endingSoon");
                      })()}
                    </p>
                  )}

                  <Async
                    loading={regular.isLoading}
                    error={regular.error}
                    data={regular.data}
                    onRetry={() => regular.refetch()}
                    skeleton={<SkeletonList rows={6} height={56} />}
                  >
                    {(r) =>
                      r.entries.length === 0 ? (
                        <p className="lg__empty-desc" style={{ marginTop: 32 }}>{t("league.noRanking")}</p>
                      ) : (
                        <RankingList entries={r.entries} meId={r.me?.user_id} />
                      )
                    }
                  </Async>
                </>
              )
            }
          </Async>
        )}
      </div>

      {info && <LeagueGuideSheet onClose={() => setInfo(false)} />}
      {lifecycle.data && <LeagueLifecycleModal lifecycle={lifecycle.data} />}
    </div>
  );
}
