import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Async, ErrorState, LoadingState, SkeletonList } from "../components/ui/states";
import { MedalIcon, RankAvatar } from "../components/brand/RankBits";
import { gameApi } from "../api/endpoints";
import { LEAGUE_TIERS, TIER_META, tierIndex, type LeagueTier } from "../lib/league";
import type { RankingEntry } from "../lib/types";
import { LeagueLifecycleModal, useLeagueLifecycle } from "./LeagueLifecycleModals";
import { LeagueGuideSheet } from "./LeagueGuide";
import { FriendLeague } from "./FriendLeague";

type Tab = "regular" | "friend";

/* ------------------------------ helpers -------------------------------- */
/** Human "Nd Nh Nm" remaining until a season's end (from real backend timing). */
function countdown(endsAt: string, now = Date.now()): string {
  const ms = new Date(endsAt).getTime() - now;
  if (Number.isNaN(ms) || ms <= 0) return "곧 종료돼요";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return `${d}일 ${h}시간 ${m}분`;
}

/** League shield badge — tinted for reached tiers, gray + lock for future ones. */
function LeagueBadge({ tier, reached, current }: { tier: LeagueTier; reached: boolean; current: boolean }) {
  const color = reached ? TIER_META[tier].color : "#cdccc9";
  return (
    <svg
      viewBox="0 0 64 72"
      className={`lg__badge ${current ? "is-current" : ""}`}
      role="img"
      aria-label={`${TIER_META[tier].label}${current ? ", 현재 리그" : reached ? "" : ", 잠김"}`}
    >
      <path d="M32 3l25 9v22c0 17-12 28-25 33C19 62 7 51 7 34V12l25-9z" fill={color} />
      <path d="M32 3l25 9v22c0 17-12 28-25 33C19 62 7 51 7 34V12l25-9z" fill="url(#lgShine)" />
      <path
        d="M32 16l4.8 9.7 10.7 1.6-7.7 7.5 1.8 10.6L32 50.9l-9.6 4.9 1.8-10.6-7.7-7.5 10.7-1.6L32 16z"
        fill="#ffffff"
        opacity={reached ? 0.92 : 0.7}
      />
      {!reached && <circle cx="32" cy="34" r="7.5" fill="#9a958d" />}
      {!reached && <path d="M28.6 32.5v-1.8a3.4 3.4 0 016.8 0v1.8M27.2 32.5h9.6v5.5h-9.6z" stroke="#fff" strokeWidth="1.5" fill="none" />}
      <defs>
        <radialGradient id="lgShine" cx="0.35" cy="0.28" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
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
      aria-label="리그 진행 상황"
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
            aria-label={`${e.rank}위 ${e.nickname ?? "회원"}${isMe ? " (나)" : ""} ${e.points}포인트`}
          >
            <span className="lg__rank-no">{e.rank}</span>
            <RankAvatar entry={e} />
            <span className="lg__rank-name">
              {e.nickname ?? "회원"}
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
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("regular");
  const [info, setInfo] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  // Server-authoritative entry lifecycle gates the whole screen (§1, §17, §23).
  const lifecycle = useLeagueLifecycle();
  const mine = useQuery({ queryKey: ["league-me"], queryFn: gameApi.myLeague });
  const season = useQuery({ queryKey: ["league-season"], queryFn: gameApi.currentSeason });
  const regular = useQuery({ queryKey: ["league-rankings", "regular"], queryFn: gameApi.currentRankings, enabled: tab === "regular" });

  // Live countdown — re-tick once a minute while the screen is open.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const dormant = !!mine.data?.dormant;
  const currentTier = (mine.data?.tier ?? "green") as LeagueTier;

  return (
    <div className="screen lg">
      <div className="screen__body screen__body--nav lg__body">
        {/* Segmented sub-tabs + 히스토리 */}
        <div className="lg__tabs">
          <div className="lg__tabset" role="tablist" aria-label="리그">
            <button role="tab" aria-selected={tab === "regular"} className={`lg__tab ${tab === "regular" ? "is-active" : ""}`} onClick={() => setTab("regular")}>
              정규 리그
            </button>
            <button role="tab" aria-selected={tab === "friend"} className={`lg__tab ${tab === "friend" ? "is-active" : ""}`} onClick={() => setTab("friend")}>
              친구 리그
            </button>
            <button role="tab" aria-selected={false} className="lg__tab" onClick={() => nav("/points")}>
              My 포인트
            </button>
          </div>
          {tab === "friend" ? (
            <button className="lg__history" onClick={() => nav("/social")} aria-label="친구 관리">
              친구 관리
            </button>
          ) : (
            <button className="lg__history" onClick={() => nav("/league/history")} aria-label="리그 히스토리 보기">
              히스토리
            </button>
          )}
        </div>

        {tab === "friend" ? (
          /* Friend League has its own podium hero + list; it does not use the
             regular-league lifecycle/carousel. */
          <FriendLeague />
        ) : !lifecycle.data ? (
          /* Wait for the authoritative lifecycle before rendering ranking/empty
             so the correct modal/state shows without flashing the wrong screen. */
          lifecycle.error ? (
            <ErrorState message="리그 정보를 불러오지 못했어요." onRetry={() => lifecycle.refetch()} />
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
                <div className="lg__empty">
                  <div className="lg__empty-badge" aria-hidden="true">
                    <LeagueBadge tier="green" reached={false} current={false} />
                  </div>
                  <p className="lg__empty-title">아직 참가 중인 리그가 없어요</p>
                  <p className="lg__empty-desc">
                    학습을 시작하고
                    <br />
                    리그에 도전해보세요!
                  </p>
                </div>
              ) : (
                <>
                  <LeagueCarousel currentTier={currentTier} />
                  <div className="lg__title-row">
                    <span className="lg__title">{TIER_META[currentTier]?.label ?? m.tier_label}</span>
                    <button className="lg__info-btn" onClick={() => setInfo(true)} aria-label="리그 안내 열기">
                      ?
                    </button>
                  </div>
                  {season.data?.ends_at && <p className="lg__timer">남은 시간: {countdown(season.data.ends_at, nowTick)}</p>}

                  <Async
                    loading={regular.isLoading}
                    error={regular.error}
                    data={regular.data}
                    onRetry={() => regular.refetch()}
                    skeleton={<SkeletonList rows={6} height={56} />}
                  >
                    {(r) =>
                      r.entries.length === 0 ? (
                        <p className="lg__empty-desc" style={{ marginTop: 32 }}>아직 순위가 없어요</p>
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
