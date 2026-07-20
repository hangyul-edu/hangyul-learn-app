import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, SkeletonList, Spinner } from "../components/ui/states";
import { CitrusBadge } from "../components/brand/LeagueGuideArt";
import { useAuth } from "../hooks/auth";
import { TIER_META, type LeagueTier } from "../lib/league";
import { normalizeLanguage, type AppLanguage } from "../lib/language";
import { gameApi } from "../api/endpoints";
import type { LeagueHistoryItem, LeagueHistorySeason } from "../lib/types";

type Phase = "loading" | "ready" | "error";
type More = "idle" | "loading" | "done" | "error";

/* ------------------------------ localization ---------------------------- */
type Quarter = "spring" | "summer" | "fall" | "winter";
const QUARTER_LABEL: Record<AppLanguage, Record<Quarter, string>> = {
  ko: { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" },
  en: { spring: "Spring", summer: "Summer", fall: "Fall", winter: "Winter" },
};
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const LH_COPY = {
  ko: {
    title: "리그 히스토리",
    back: "뒤로 가기",
    ongoing: "진행 중",
    emptyTitle: "이 시즌의 리그 기록이 없어요",
    emptyDesc: "참여한 리그 기록이 생기면 여기에 표시됩니다.",
    seasonError: "시즌 정보를 불러오지 못했어요.",
    listError: "리그 기록을 불러오지 못했어요.",
    loadMore: "다시 불러오기",
    listAria: "리그 기록",
    seasonPickerAria: "시즌 목록",
    // Hero line 2, e.g. "봄 시즌 리그".
    heroName: (q: Quarter) => `${QUARTER_LABEL.ko[q]} 시즌 리그`,
    // Selector option, e.g. "2026 봄 시즌".
    optionLabel: (year: number, q: Quarter) => `${year} ${QUARTER_LABEL.ko[q]} 시즌`,
    selectAria: (label: string) => `${label} 선택됨, 시즌 변경`,
  },
  en: {
    title: "League History",
    back: "Go back",
    ongoing: "In Progress",
    emptyTitle: "No league history for this season",
    emptyDesc: "Your league records will appear here once you participate.",
    seasonError: "Couldn't load seasons.",
    listError: "Couldn't load league history.",
    loadMore: "Load more",
    listAria: "League history",
    seasonPickerAria: "Seasons",
    heroName: (q: Quarter) => `${QUARTER_LABEL.en[q]} League`,
    optionLabel: (year: number, q: Quarter) => `${year} ${QUARTER_LABEL.en[q]} Season`,
    selectAria: (label: string) => `${label} selected, change season`,
  },
} as const;

/* ------------------------------ formatting ------------------------------ */
// ISO date "2026-04-27" → "04.27".
const mmdd = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
const spokenDate = (iso: string, lang: AppLanguage) => {
  const [, m, d] = iso.split("-");
  return lang === "ko" ? `${m}월 ${Number(d)}일` : `${EN_MONTHS[Number(m) - 1]} ${Number(d)}`;
};

function rowAria(item: LeagueHistoryItem, lang: AppLanguage): string {
  const tier = TIER_META[item.tier as LeagueTier]?.label ?? item.tier_label ?? "";
  const range =
    lang === "ko"
      ? `${spokenDate(item.week_start, "ko")}부터 ${spokenDate(item.week_end, "ko")}까지`
      : `${spokenDate(item.week_start, "en")} to ${spokenDate(item.week_end, "en")}`;
  const status = item.is_current ? `, ${LH_COPY[lang].ongoing}` : "";
  const rank =
    item.rank != null
      ? lang === "ko"
        ? `, ${item.is_current ? "현재 " : ""}${item.rank}위`
        : `, ${item.is_current ? "currently " : ""}rank ${item.rank}`
      : "";
  const pts = lang === "ko" ? `, ${item.points}포인트` : `, ${item.points} points`;
  return `${tier}, ${range}${status}${rank}${pts}`;
}

function dedupById(items: LeagueHistoryItem[]): LeagueHistoryItem[] {
  const seen = new Set<string>();
  const out: LeagueHistoryItem[] = [];
  for (const item of items) {
    if (seen.has(item.league_week_id)) continue;
    seen.add(item.league_week_id);
    out.push(item);
  }
  return out;
}

/* -------------------------------- art ----------------------------------- */
/** Decorative hanging striped pennant in the season hero (no rank/number). */
function SeasonBanner() {
  return (
    <svg className="lh__banner" viewBox="0 0 96 150" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lhBannerClip">
          <path d="M22 30h52v72l-26-13-26 13z" />
        </clipPath>
      </defs>
      <path d="M48 3v25" stroke="#c8ccd2" strokeWidth="3" strokeLinecap="round" />
      <rect x="14" y="24" width="68" height="9" rx="4.5" fill="#d7dce1" />
      <circle cx="16" cy="28.5" r="7.5" fill="#c3c9d1" />
      <circle cx="80" cy="28.5" r="7.5" fill="#c3c9d1" />
      <g clipPath="url(#lhBannerClip)">
        <rect x="22" y="30" width="13" height="82" fill="#ffe07a" />
        <rect x="35" y="30" width="13" height="82" fill="#fff2c2" />
        <rect x="48" y="30" width="13" height="82" fill="#ffe07a" />
        <rect x="61" y="30" width="13" height="82" fill="#fff2c2" />
      </g>
      <path d="M22 30h52v72l-26-13-26 13z" fill="none" stroke="#f2c94c" strokeWidth="2" />
    </svg>
  );
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

/** Vertical pennant rank badge: colored for ranks 1–3, neutral gray otherwise. */
function RankPennant({ rank }: { rank: number | null }) {
  const top3 = rank != null && rank <= 3;
  const color = rank === 1 ? "#f0483a" : rank === 2 ? "#3b82f6" : rank === 3 ? "#22c55e" : "#aab2ba";
  return (
    <span className={`lh__pennant ${top3 ? "is-top3" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 30 44" width="30" height="44">
        <path d="M4 2h22a2 2 0 0 1 2 2v30l-13-7-13 7V4a2 2 0 0 1 2-2z" fill={color} />
        {top3 && <circle cx="15" cy="8" r="3.8" fill="#ffd23f" />}
      </svg>
      <span className="lh__pennant-num">{rank ?? "-"}</span>
    </span>
  );
}

/* -------------------------------- rows ---------------------------------- */
function HistoryRow({ item, lang }: { item: LeagueHistoryItem; lang: AppLanguage }) {
  return (
    <li className="lh__row" aria-label={rowAria(item, lang)}>
      <LeagueTierIcon tier={item.tier} />
      <span className="lh__row-date">{`${mmdd(item.week_start)}~${mmdd(item.week_end)}`}</span>
      {item.is_current && <span className="lh__ongoing">{LH_COPY[lang].ongoing}</span>}
      <span className="lh__row-spacer" />
      <RankPennant rank={item.rank} />
      <span className="lh__row-pts">{item.points}P</span>
    </li>
  );
}

/* -------------------------------- screen -------------------------------- */
export function LeagueHistory() {
  const nav = useNavigate();
  const { me } = useAuth();
  const lang = normalizeLanguage(me?.app_language);
  const copy = LH_COPY[lang];
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
      setItems((prev) => dedupById([...prev, ...page.items]));
      setCursor(page.next_cursor);
      setMore(page.next_cursor ? "idle" : "done");
    } catch {
      if (mySeq === seqRef.current) setMore("error");
    } finally {
      if (mySeq === seqRef.current) loadingRef.current = false;
    }
  }

  // Fetch the next page as the sentinel nears the viewport.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && more === "idle") void loadMore();
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, cursor, items.length, selectedId]);

  const selectedSeason = seasons.data?.seasons.find((s) => s.season_id === selectedId);

  return (
    <div className="screen lh">
      {/* Header */}
      <header className="lh__header">
        <button className="lh__back" onClick={() => nav(-1)} aria-label={copy.back}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
                      <path d="M6 9l6 6 6-6" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                      <HistoryRow key={item.league_week_id} item={item} lang={lang} />
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
