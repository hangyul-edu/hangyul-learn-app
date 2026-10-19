import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Async, ErrorState, LoadingState, SkeletonList } from "../components/ui/states";
import { gameApi } from "../api/endpoints";
import { TIER_META, type LeagueTier } from "../lib/league";
import { LeagueLifecycleModal, useLeagueLifecycle } from "./LeagueLifecycleModals";
import { LeagueGuideSheet } from "./LeagueGuide";
import { FriendLeague } from "./FriendLeague";
import { MyPoints } from "./MyPoints";
import { LeagueCarousel } from "./league/LeagueCarousel";
import { RankingList } from "./league/RankingList";
import { SeasonTimer } from "./league/SeasonTimer";

type Tab = "regular" | "friend" | "points";
const TABS: [Tab, TranslationKey][] = [
  ["regular", "league.tabRegular"],
  ["friend", "league.tabFriends"],
  ["points", "league.myPoints"],
];

/* -------------------------------- screen ------------------------------- */
export function League() {
  const { t } = useTranslation();
  const nav = useNavigate();
  // Optional deep-link, e.g. `/league?tab=points` (used by the /points route).
  // The URL is the tab's only state, so coming back from 친구 관리 (/social)
  // or any other screen reopens the tab the user left — local state reset to
  // 정규 리그 on every return. Replace, not push: switching tabs is not a
  // step the back button should walk through.
  const [params, setParams] = useSearchParams();
  const urlTab = params.get("tab");
  const tab: Tab = urlTab === "friend" || urlTab === "points" ? urlTab : "regular";
  const setTab = (next: Tab) =>
    setParams(next === "regular" ? {} : { tab: next }, { replace: true });
  const [info, setInfo] = useState(false);

  // Server-authoritative entry lifecycle gates the whole screen: a modal for
  // every state that is not simply "you are in a league". See
  // LeagueLifecycleModals.tsx.
  const lifecycle = useLeagueLifecycle();
  const mine = useQuery({ queryKey: ["league-me"], queryFn: gameApi.myLeague });
  const season = useQuery({ queryKey: ["league-season"], queryFn: gameApi.currentSeason });
  const regular = useQuery({ queryKey: ["league-rankings", "regular"], queryFn: gameApi.currentRankings, enabled: tab === "regular" });

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
            {TABS.map(([value, label]) => (
              <button key={value} role="tab" aria-selected={tab === value} className={`lg__tab ${tab === value ? "is-active" : ""}`} onClick={() => setTab(value)}>
                {t(label)}
              </button>
            ))}
          </div>
          {tab === "friend" ? (
            <button className="lg__history lg__history--manage" onClick={() => nav("/social")} aria-label={t("league.manageFriends")}>
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
                  {season.data?.ends_at && <SeasonTimer endsAt={season.data.ends_at} />}

                  <Async
                    loading={regular.isLoading}
                    error={regular.error}
                    data={regular.data}
                    onRetry={() => regular.refetch()}
                    skeleton={<SkeletonList rows={6} height={56} />}
                  >
                    {(r) =>
                      r.entries.length === 0 ? (
                        <p className="lg__empty-desc lg__empty-desc--ranking">{t("league.noRanking")}</p>
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
      {/* The lifecycle is the regular league's state — no seat yet, a result
          to see, the gap between weeks. It must not stand between the member
          and 친구 리그, My 포인트 or 히스토리, which work with or without a
          regular league, so it shows on the 정규 리그 tab only and leaves the
          tab row (and its 히스토리 button) uncovered. */}
      {tab === "regular" && lifecycle.data && <LeagueLifecycleModal lifecycle={lifecycle.data} />}
    </div>
  );
}
