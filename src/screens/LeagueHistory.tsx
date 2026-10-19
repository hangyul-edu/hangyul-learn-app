import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, SkeletonList, Spinner } from "../components/ui/states";
import { CitrusBadge } from "../components/brand/LeagueGuideArt";
import { TIER_META, type LeagueTier } from "../lib/league";
import lhBanner from "../assets/brand/lh-season-banner.svg";
import { useTranslation, type TranslationKey, type Translate } from "../i18n";
import { gameApi } from "../api/endpoints";
import type { LeagueHistoryItem, LeagueHistorySeason } from "../lib/types";
import { BackChevronIcon } from "../components/brand/Glyphs";
import { useLoadMoreSentinel } from "../hooks/useLoadMoreSentinel";
import { uniqueBy } from "../lib/collections";

type Phase = "loading" | "ready" | "error";
type More = "idle" | "loading" | "done" | "error";

/* ------------------------------ localization ---------------------------- */
type Quarter = "spring" | "summer" | "fall" | "winter";
/** Quarter → catalog key; the season name itself is localized. */
const QUARTER_KEYS: Record<Quarter, TranslationKey> = {
  spring: "leagueHistory.quarterSpring",
  summer: "leagueHistory.quarterSummer",
  fall: "leagueHistory.quarterFall",
  winter: "leagueHistory.quarterWinter",
};

/** League-history copy, bound to the active language (`leagueHistory.*`). */
function useLhCopy() {
  const { t } = useTranslation();
  return {
    title: t("leagueHistory.title"),
    back: t("common.back"),
    ongoing: t("leagueHistory.ongoing"),
    emptyTitle: t("leagueHistory.emptyTitle"),
    emptyDesc: t("leagueHistory.emptyDesc"),
    seasonError: t("leagueHistory.seasonError"),
    listError: t("leagueHistory.listError"),
    loadMore: t("leagueHistory.loadMore"),
    listAria: t("leagueHistory.listAria"),
    seasonPickerAria: t("leagueHistory.seasonPickerAria"),
    heroName: (q: Quarter) => t("leagueHistory.heroName", { quarter: t(QUARTER_KEYS[q]) }),
    optionLabel: (year: number, q: Quarter) =>
      t("leagueHistory.optionLabel", { year, quarter: t(QUARTER_KEYS[q]) }),
    selectAria: (label: string) => t("leagueHistory.selectAria", { label }),
  };
}

/* ------------------------------ formatting ------------------------------ */
// ISO date "2026-04-27" → "04.27".
const mmdd = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
/** ISO date spoken for screen readers, in the active language. */
const spokenDate = (
  iso: string,
  t: Translate,
) => {
  const [, m, d] = iso.split("-");
  return t("leagueHistory.spokenDate", { m: Number(m), d: Number(d) });
};

function rowAria(
  item: LeagueHistoryItem,
  t: Translate,
): string {
  const meta = TIER_META[item.tier as LeagueTier];
  const tier = meta ? t("league.tierLabel", { tier: meta.name }) : item.tier_label ?? "";
  const range = t("leagueHistory.rangeA11y", {
    from: spokenDate(item.week_start, t),
    to: spokenDate(item.week_end, t),
  });
  const status = item.is_current ? `, ${t("leagueHistory.ongoing")}` : "";
  const rank =
    item.rank != null
      ? t("leagueHistory.rankA11y", {
          current: item.is_current ? t("leagueHistory.currentPrefix") : "",
          rank: item.rank,
        })
      : "";
  const pts = t("leagueHistory.pointsA11y", { points: item.points });
  return `${tier}, ${range}${status}${rank}${pts}`;
}

/* -------------------------------- art ----------------------------------- */
/** Season banner — Figma's own `Group 1410118688` (393:16605), 119x180. */
function SeasonBanner() {
  return <img className="lh__callout" src={lhBanner} alt="" aria-hidden="true" />;
}

/** The user's league badge for that period — the official citrus tier image,
 *  tinted per tier on a pale circular background. */
function LeagueTierIcon({ tier }: { tier: string }) {
  const color = TIER_META[tier as LeagueTier]?.color ?? "#b8c0c8";
  return (
    <span className="lh__tier" style={{ background: `${color}22` }} aria-hidden="true">
      <CitrusBadge tier={tier} className="lh__citrus" />
    </span>
  );
}

/** Outer fill per rank — LEG-009 390:15855 varies only this. */
const RANK_FILL: Record<number, string> = { 1: "#b91d00", 2: "#004ab9", 3: "#007d00" };

/**
 * Rank ribbon — Group 1410118683 (LEG-009 390:15855). A 27x27 bookmark, which
 * is Figma's exported `Vector 1345` used as a mask so one asset serves every
 * rank colour; the 14.294-wide band inside it is #FFDD6E on the podium and
 * #DBDDDF otherwise, and the rank sits on top in Bold 10 / Gray 5.
 */
function RankPennant({ rank }: { rank: number | null }) {
  const podium = rank != null && rank <= 3;
  const color = (rank != null && RANK_FILL[rank]) || "#adb4ba";
  return (
    <span className="lh__pennant" aria-hidden="true">
      <span className="lh__pennant-flag" style={{ background: color }}>
        <span className="lh__pennant-band" style={{ background: podium ? "#ffdd6e" : "#dbdddf" }} />
      </span>
      <span className="lh__pennant-num">{rank ?? "-"}</span>
    </span>
  );
}

/* -------------------------------- rows ---------------------------------- */
function HistoryRow({ item }: { item: LeagueHistoryItem }) {
  const { t } = useTranslation();
  return (
    <li className="lh__row" aria-label={rowAria(item, t)}>
      <LeagueTierIcon tier={item.tier} />
      <span className="lh__row-date">{`${mmdd(item.week_start)}~${mmdd(item.week_end)}`}</span>
      {item.is_current && <span className="lh__ongoing">{t("leagueHistory.ongoing")}</span>}
      <span className="lh__row-spacer" />
      <RankPennant rank={item.rank} />
      <span className="lh__row-pts">{item.points}P</span>
    </li>
  );
}

/* -------------------------------- screen -------------------------------- */
export function LeagueHistory() {
  const nav = useNavigate();
  const copy = useLhCopy();
  const labelOf = (s: LeagueHistorySeason) => copy.optionLabel(s.year, s.quarter as Quarter);

  const seasons = useQuery({ queryKey: ["league-history-seasons"], queryFn: gameApi.leagueHistorySeasons });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);

  const [items, setItems] = useState<LeagueHistoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [more, setMore] = useState<More>("idle");
  const [reloadKey, setReloadKey] = useState(0);
  const seqRef = useRef(0);
  const loadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Adopt the backend's default season once the list arrives.
  useEffect(() => {
    if (selectedId == null && seasons.data) setSelectedId(seasons.data.default_season_id);
  }, [seasons.data, selectedId]);

  // (Re)load page 1 whenever the selected season changes. A seq guard discards
  // late responses so switching seasons never shows the previous season's rows.
  useEffect(() => {
    if (!selectedId) return;
    const mySeq = ++seqRef.current;
    setItems([]);
    setCursor(null);
    setPhase("loading");
    setMore("idle");
    loadingRef.current = true;
    gameApi
      .leagueHistory({ seasonId: selectedId })
      .then((page) => {
        if (mySeq !== seqRef.current) return;
        setItems(page.items);
        setCursor(page.next_cursor);
        setMore(page.next_cursor ? "idle" : "done");
        setPhase("ready");
      })
      .catch(() => {
        if (mySeq === seqRef.current) setPhase("error");
      })
      .finally(() => {
        if (mySeq === seqRef.current) loadingRef.current = false;
      });
  }, [selectedId, reloadKey]);

  async function loadMore() {
    if (loadingRef.current || cursor == null || !selectedId) return;
    loadingRef.current = true;
    const mySeq = seqRef.current;
    setMore("loading");
    try {
      const page = await gameApi.leagueHistory({ seasonId: selectedId, cursor });
      if (mySeq !== seqRef.current) return;
      setItems((prev) => uniqueBy([...prev, ...page.items], (item) => item.league_week_id));
      setCursor(page.next_cursor);
      setMore(page.next_cursor ? "idle" : "done");
    } catch {
      if (mySeq === seqRef.current) setMore("error");
    } finally {
      if (mySeq === seqRef.current) loadingRef.current = false;
    }
  }

  // Fetch the next page as the sentinel nears the viewport.
  useLoadMoreSentinel(sentinel, { enabled: more === "idle", onHit: () => void loadMore(), rootRef: scrollRef, rootMargin: "300px" }, [more, cursor, items.length, selectedId]);

  const selectedSeason = seasons.data?.seasons.find((s) => s.season_id === selectedId);

  return (
    <div className="screen lh">
      {/* Header */}
      <header className="lh__header">
        <button className="lh__back" onClick={() => nav(-1)} aria-label={copy.back}>
          <BackChevronIcon color="#262c31" />
        </button>
        <h1 className="lh__title">{copy.title}</h1>
      </header>

      <div className="screen__body lh__body" ref={scrollRef}>
        {seasons.error ? (
          <ErrorState message={copy.seasonError} onRetry={() => seasons.refetch()} />
        ) : seasons.isLoading || !selectedSeason ? (
          // Still resolving seasons, or the default season hasn't been adopted
          // yet (one render tick) — show loading, never a spurious error flash.
          <LoadingState />
        ) : (
          <>
            {/* Season hero + selector — the dropdown opens directly below the
                season title/chevron; a full-frame backdrop dims + dismisses. */}
            <div className="lh__hero">
              <SeasonBanner />
              <div className="lh__season-anchor">
                <button
                  className="lh__season"
                  onClick={() => setDropOpen((v) => !v)}
                  aria-haspopup="listbox"
                  aria-expanded={dropOpen}
                  aria-label={copy.selectAria(labelOf(selectedSeason))}
                >
                  <span className="lh__season-year">{selectedSeason.year}</span>
                  <span className="lh__season-name">
                    {copy.heroName(selectedSeason.quarter as Quarter)}
                    <svg className={`lh__chevron ${dropOpen ? "is-open" : ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 9l6 6 6-6" stroke="#262c31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
                {dropOpen && seasons.data && (
                  <ul className="lh-drop__panel" role="listbox" aria-label={copy.seasonPickerAria} onClick={(e) => e.stopPropagation()}>
                    {seasons.data.seasons.map((season) => {
                      const active = season.season_id === selectedSeason.season_id;
                      return (
                        <li key={season.season_id} role="none">
                          <button
                            role="option"
                            aria-selected={active}
                            className={`lh-drop__option ${active ? "is-active" : ""}`}
                            onClick={() => {
                              setSelectedId(season.season_id);
                              setDropOpen(false);
                            }}
                          >
                            {labelOf(season)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {dropOpen && <div className="lh-drop" role="presentation" onClick={() => setDropOpen(false)} />}
            </div>

            {/* History list card */}
            <div className="lh__card">
              {phase === "loading" ? (
                <div className="lh__pad">
                  <SkeletonList rows={5} height={60} />
                </div>
              ) : phase === "error" ? (
                <ErrorState message={copy.listError} onRetry={() => setReloadKey((k) => k + 1)} />
              ) : items.length === 0 ? (
                <EmptyState emoji="🗂️" title={copy.emptyTitle} text={copy.emptyDesc} />
              ) : (
                <>
                  <ul className="lh__rows" role="list" aria-label={copy.listAria}>
                    {items.map((item) => (
                      <HistoryRow key={item.league_week_id} item={item} />
                    ))}
                  </ul>
                  <div className="lh__foot" ref={sentinel}>
                    {more === "loading" && <Spinner />}
                    {more === "error" && (
                      <button className="lh__more-retry" onClick={() => { setMore("idle"); void loadMore(); }}>
                        {copy.loadMore}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
