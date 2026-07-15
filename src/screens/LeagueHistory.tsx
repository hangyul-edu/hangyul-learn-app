import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, SkeletonList, Spinner } from "../components/ui/states";
import { TIER_META, type LeagueTier } from "../lib/league";
import { gameApi } from "../api/endpoints";
import type { LeagueHistoryItem, LeagueHistorySeason } from "../lib/types";

const QUARTER_KO: Record<string, string> = { spring: "봄", summer: "여름", fall: "가을", winter: "겨울" };

type Phase = "loading" | "ready" | "error";
type More = "idle" | "loading" | "done" | "error";

/* ------------------------------ formatting ------------------------------ */
// ISO date "2026-04-27" → "04.27" (display) / "04월 27일" (screen-reader).
const mmdd = (iso: string) => `${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
const spokenDate = (iso: string) => `${iso.slice(5, 7)}월 ${iso.slice(8, 10)}일`;

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

/* -------------------------------- badges -------------------------------- */
/** Circular league medal (left of each row) tinted by the week's tier. */
function LeagueMedal({ tier }: { tier: string }) {
  const color = TIER_META[tier as LeagueTier]?.color ?? "#b8c0c8";
  return (
    <span className="lh__medal" aria-hidden="true">
      <svg viewBox="0 0 40 44" width="30" height="33">
        <path d="M20 3l14 5v12c0 9-6.6 15.4-14 18-7.4-2.6-14-9-14-18V8l14-5z" fill={color} />
        <path d="M20 3l14 5v12c0 9-6.6 15.4-14 18-7.4-2.6-14-9-14-18V8l14-5z" fill="url(#lhShine)" />
        <path d="M20 11l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L20 30l-5.8 3 1.1-6.5-4.7-4.6 6.5-1L20 11z" fill="#fff" opacity="0.92" />
        <defs>
          <radialGradient id="lhShine" cx="0.35" cy="0.28" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </span>
  );
}

/** Numbered rank badge, colored by finishing position (gray for the rest). */
function RankBadge({ rank }: { rank: number | null }) {
  const color = rank === 1 ? "#f5b21a" : rank === 2 ? "#3b82f6" : rank === 3 ? "#22c55e" : "#b8c0c8";
  return (
    <span className="lh__rankbadge" aria-hidden="true">
      <svg viewBox="0 0 32 34" width="28" height="30">
        <path d="M16 2l12 4v11c0 8-5.6 12.8-12 15C9.6 29.8 4 25 4 17V6l12-4z" fill={color} />
        <path d="M16 2l12 4v11c0 8-5.6 12.8-12 15C9.6 29.8 4 25 4 17V6l12-4z" fill="url(#rbShine)" />
        <defs>
          <radialGradient id="rbShine" cx="0.35" cy="0.28" r="0.8">
            <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
            <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="lh__rankbadge-num">{rank ?? "-"}</span>
    </span>
  );
}

/* -------------------------------- rows ---------------------------------- */
function HistoryRow({ item }: { item: LeagueHistoryItem }) {
  const rangeLabel = `${mmdd(item.week_start)}~${mmdd(item.week_end)}`;
  const aria =
    `${spokenDate(item.week_start)}부터 ${spokenDate(item.week_end)}까지` +
    `${item.is_current ? ", 진행 중" : ""}` +
    `${item.rank != null ? `, 순위 ${item.rank}위` : ", 순위 없음"}` +
    `, ${item.points} 포인트`;
  return (
    <li className="lh__row" aria-label={aria}>
      <LeagueMedal tier={item.tier} />
      <span className="lh__row-date">{rangeLabel}</span>
      {item.is_current && <span className="lh__ongoing">진행 중</span>}
      <span className="lh__row-spacer" />
      <RankBadge rank={item.rank} />
      <span className="lh__row-pts">{item.points}P</span>
    </li>
  );
}

/* ------------------------------ dropdown -------------------------------- */
function SeasonDropdown({
  seasons,
  selectedId,
  onSelect,
  onClose,
}: {
  seasons: LeagueHistorySeason[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="lh-drop" role="dialog" aria-label="시즌 선택" onClick={onClose}>
      <ul className="lh-drop__panel" role="listbox" aria-label="시즌 목록" onClick={(e) => e.stopPropagation()}>
        {seasons.map((season) => {
          const active = season.season_id === selectedId;
          return (
            <li key={season.season_id} role="none">
              <button
                role="option"
                aria-selected={active}
                className={`lh-drop__option ${active ? "is-active" : ""}`}
                onClick={() => onSelect(season.season_id)}
              >
                {season.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------- screen -------------------------------- */
export function LeagueHistory() {
  const nav = useNavigate();
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
        <button className="lh__back" onClick={() => nav(-1)} aria-label="뒤로 가기">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="lh__title">리그 히스토리</h1>
      </header>

      <div className="screen__body lh__body" ref={scrollRef}>
        {seasons.error ? (
          <ErrorState message="시즌 정보를 불러오지 못했어요." onRetry={() => seasons.refetch()} />
        ) : seasons.isLoading || !selectedSeason ? (
          // Still resolving seasons, or the default season hasn't been adopted
          // yet (one render tick) — show loading, never a spurious error flash.
          <LoadingState />
        ) : (
          <>
            {/* Season hero + selector */}
            <div className="lh__hero">
              <span className="lh__flag" aria-hidden="true">🚩</span>
              <button
                className="lh__season"
                onClick={() => setDropOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={dropOpen}
                aria-label={`시즌 선택, 현재 ${selectedSeason.label}`}
              >
                <span className="lh__season-year">{selectedSeason.year}</span>
                <span className="lh__season-name">
                  {QUARTER_KO[selectedSeason.quarter] ?? ""} 시즌 리그
                  <svg className="lh__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" stroke="#272c30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </div>

            {/* History list card */}
            <div className="lh__card">
              {phase === "loading" ? (
                <div className="lh__pad">
                  <SkeletonList rows={5} height={56} />
                </div>
              ) : phase === "error" ? (
                <ErrorState message="리그 기록을 불러오지 못했어요." onRetry={() => setReloadKey((k) => k + 1)} />
              ) : items.length === 0 ? (
                <EmptyState emoji="🏳️" title="이 시즌의 리그 기록이 아직 없어요" />
              ) : (
                <>
                  <ul className="lh__rows" role="list" aria-label="리그 기록">
                    {items.map((item) => (
                      <HistoryRow key={item.league_week_id} item={item} />
                    ))}
                  </ul>
                  <div className="lh__foot" ref={sentinel}>
                    {more === "loading" && <Spinner />}
                    {more === "error" && (
                      <button className="lh__more-retry" onClick={() => { setMore("idle"); void loadMore(); }}>
                        다시 불러오기
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {dropOpen && selectedSeason && seasons.data && (
        <SeasonDropdown
          seasons={seasons.data.seasons}
          selectedId={selectedSeason.season_id}
          onSelect={(id) => {
            setSelectedId(id);
            setDropOpen(false);
          }}
          onClose={() => setDropOpen(false)}
        />
      )}
    </div>
  );
}
