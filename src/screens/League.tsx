import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar } from "../components/ui/kit";
import { Async, SkeletonList } from "../components/ui/states";
import { CharacterArt, avatarBg, type AvatarKey } from "../components/brand/ProfileAssets";
import { gameApi } from "../api/endpoints";
import { LEAGUE_POINT_RULES, LEAGUE_TIERS, TIER_META, tierIndex, type LeagueTier } from "../lib/league";
import type { RankingEntry } from "../lib/types";

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

const MedalIcon = ({ rank }: { rank: number }) => {
  const fill = rank === 1 ? "#f5c518" : rank === 2 ? "#c4ccd4" : "#e08a4a";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3l2.2 4.4L15 8 8 3zM16 3l-2.2 4.4L9 8l7-5z" fill={fill} opacity="0.85" />
      <circle cx="12" cy="15" r="6" fill={fill} />
      <circle cx="12" cy="15" r="6" fill="url(#medalShine)" />
      <path d="M12 11.6l1 2 2.2.3-1.6 1.5.4 2.2L12 18.5l-2 1.1.4-2.2L8.8 16l2.2-.3 1-2z" fill="#fff8e0" />
      <defs>
        <radialGradient id="medalShine" cx="0.38" cy="0.32" r="0.7">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
};

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

/** Real avatar for a ranking row: uploaded photo → character → initial fallback. */
function RankAvatar({ entry }: { entry: RankingEntry }) {
  if (entry.profile_image_type === "CUSTOM" && entry.profile_image_url) {
    return <Avatar url={entry.profile_image_url} name={entry.nickname} size={38} />;
  }
  if (entry.profile_image_type === "AVATAR" && entry.avatar_key) {
    const key = entry.avatar_key as AvatarKey;
    return (
      <span className="lg__avatar-char" style={{ background: avatarBg(key) }} aria-hidden="true">
        <CharacterArt variant={key} fill="82%" />
      </span>
    );
  }
  return <Avatar name={entry.nickname} size={38} />;
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
  const currentRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curIdx = Math.max(0, tierIndex(currentTier));

  const recenter = (behavior: ScrollBehavior) => {
    const box = scrollRef.current;
    const el = currentRef.current;
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior });
  };

  // Center the user's current league on mount (no animation — it's the anchor).
  useLayoutEffect(() => {
    recenter("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTier]);

  // Snap back once a scroll gesture stops, so the current league re-centers.
  const scheduleRecenter = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => recenter("smooth"), 350);
  };
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  return (
    <div
      className="lg__carousel"
      ref={scrollRef}
      onScroll={scheduleRecenter}
      onTouchEnd={() => recenter("smooth")}
      onPointerUp={() => recenter("smooth")}
      aria-label="리그 진행 상황"
    >
      <div className="lg__carousel-track">
        {LEAGUE_TIERS.map((tier, i) => (
          <div
            key={tier}
            ref={i === curIdx ? currentRef : undefined}
            className={`lg__badge-slot ${i === curIdx ? "is-current" : ""}`}
            aria-current={i === curIdx ? "true" : undefined}
          >
            <LeagueBadge tier={tier} reached={i <= curIdx} current={i === curIdx} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- info modal -------------------------------- */
function InfoModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="lg-info" role="dialog" aria-modal="true" aria-label="정규 리그 안내">
      <div className="lg-info__scroll">
        <div className="lg-info__hero">
          <button className="lg-info__close" onClick={onClose} aria-label="닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="lg-info__hero-title">정규 리그</h1>
          <p className="lg-info__hero-desc">
            학습 점수로 경쟁하는 리그예요.
            <br />
            공부할수록 점수와 순위가 올라가요
          </p>
          <span className="lg-info__flag" aria-hidden="true">🚩</span>
        </div>

        <div className="lg-info__body">
          <div className="lg-info__card lg-info__schedule">
            <LeagueBadge tier="green" reached current={false} />
            <div>
              <div className="lg-info__sched-main">
                매주 월요일 00:00 시작
                <br />~ 일요일 21:00 종료
              </div>
              <div className="lg-info__sched-sub">(일요일 21시에 결과 발표)</div>
            </div>
          </div>

          <h2 className="lg-info__heading">학습할수록 리그 점수(P)가 올라가요</h2>
          {LEAGUE_POINT_RULES.map((r) => (
            <div className="lg-info__card lg-info__rule" key={r.label}>
              <div className="lg-info__rule-top">
                <span className="lg-info__rule-label">{r.label}</span>
                <span className="lg-info__rule-points">{r.points}</span>
              </div>
              {r.details.map((d) => (
                <div className="lg-info__rule-detail" key={d}>
                  {d}
                </div>
              ))}
            </div>
          ))}

          <div className="lg-info__card lg-info__promo">
            <div className="lg-info__promo-main">상위 20%만 다음 리그로 승급</div>
            <div className="lg-info__promo-sub">Green: 강등 없음</div>
            <div className="lg-info__promo-sub">Golden: 승급 없음</div>
          </div>
        </div>
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
              {isMe && <span className="lg__rank-you">나</span>}
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

  const mine = useQuery({ queryKey: ["league-me"], queryFn: gameApi.myLeague });
  const season = useQuery({ queryKey: ["league-season"], queryFn: gameApi.currentSeason });
  const regular = useQuery({ queryKey: ["league-rankings", "regular"], queryFn: gameApi.currentRankings, enabled: tab === "regular" });
  const friend = useQuery({ queryKey: ["league-rankings", "friend"], queryFn: gameApi.friendRankings, enabled: tab === "friend" });

  // Live countdown — re-tick once a minute while the screen is open.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ranks = tab === "regular" ? regular : friend;
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
          <button className="lg__history" onClick={() => nav("/league/history")} aria-label="리그 히스토리 보기">
            히스토리
          </button>
        </div>

        <Async
          loading={mine.isLoading}
          error={mine.error}
          data={mine.data}
          onRetry={() => mine.refetch()}
          skeleton={<SkeletonList rows={4} height={64} />}
        >
          {(m) =>
            tab === "regular" && dormant ? (
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
                {tab === "regular" && (
                  <>
                    <LeagueCarousel currentTier={currentTier} />
                    <div className="lg__title-row">
                      <span className="lg__title">{TIER_META[currentTier]?.label ?? m.tier_label}</span>
                      <button className="lg__info-btn" onClick={() => setInfo(true)} aria-label="리그 안내 열기">
                        ?
                      </button>
                    </div>
                    {season.data?.ends_at && <p className="lg__timer">남은 시간: {countdown(season.data.ends_at, nowTick)}</p>}
                  </>
                )}
                {tab === "friend" && (
                  <div className="lg__title-row lg__title-row--friend">
                    <span className="lg__title">친구 리그</span>
                  </div>
                )}

                <Async
                  loading={ranks.isLoading}
                  error={ranks.error}
                  data={ranks.data}
                  onRetry={() => ranks.refetch()}
                  skeleton={<SkeletonList rows={6} height={56} />}
                >
                  {(r) =>
                    r.entries.length === 0 ? (
                      <p className="lg__empty-desc" style={{ marginTop: 32 }}>
                        {tab === "friend" ? "함께 학습할 친구를 추가해보세요" : "아직 순위가 없어요"}
                      </p>
                    ) : (
                      <RankingList entries={r.entries} meId={r.me?.user_id} />
                    )
                  }
                </Async>
              </>
            )
          }
        </Async>
      </div>

      {info && <InfoModal onClose={() => setInfo(false)} />}
    </div>
  );
}
