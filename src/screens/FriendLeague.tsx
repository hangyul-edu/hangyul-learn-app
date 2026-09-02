import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { MedalIcon, RankAvatar, withSelfProfile } from "../components/brand/RankBits";
import { AddFriendSheet } from "../components/social/AddFriendSheet";
import { gameApi } from "../api/endpoints";
import { TIER_META, type LeagueTier } from "../lib/league";
import { useTranslation } from "../i18n";
import type { RankingEntry } from "../lib/types";
import { useAuthOptional } from "../hooks/auth";

/** "Green League" / "Green 리그" — the suffix differs per language. */
const useTierLabel = () => {
  const { t } = useTranslation();
  return (tier?: string) => {
    const meta = tier ? TIER_META[tier as LeagueTier] : undefined;
    return meta ? t("league.tierLabel", { tier: meta.name }) : undefined;
  };
};
const displayName = (e: RankingEntry, fallback: string) => e.nickname ?? fallback;

/* ------------------------------ empty state ----------------------------- */
// Localized per the app's copy-object convention (keyed by app_language).
/** Friend-League empty-state copy (`friendLeague.*`). */
function useEmptyCopy() {
  const { t } = useTranslation();
  return {
    title: t("friendLeague.emptyTitle"),
    line1: t("friendLeague.emptyLine1"),
    line2: t("friendLeague.emptyLine2"),
    addFriend: t("friendLeague.addFriend"),
  };
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="#8a8f96" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

/** Minimal, illustration-free empty state — shown only for a confirmed empty
 *  friend-league result (no eligible friends). The 친구 추가 button opens the
 *  Add Friend bottom sheet in place (it does not leave the League page). */
function FriendLeagueEmptyState({ onAdd }: { onAdd: () => void }) {
  const copy = useEmptyCopy();
  return (
    <div className="fl-empty">
      <h2 className="fl-empty__title">{copy.title}</h2>
      <p className="fl-empty__desc">
        {copy.line1}
        <br />
        {copy.line2}
      </p>
      <button className="fl-empty__add" onClick={onAdd}>
        <PlusIcon />
        <span>{copy.addFriend}</span>
      </button>
    </div>
  );
}

/* ------------------------------- decor ---------------------------------- */
/** Pale gray default-friend placeholder — purely decorative balance. */
function PlaceholderAvatar({ className }: { className: string }) {
  return (
    <span className={`fl__decor ${className}`} aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="5.5" fill="#c3cad2" />
        <path d="M6 27c1.5-6 18.5-6 20 0z" fill="#c3cad2" />
      </svg>
    </span>
  );
}

/** A few subtle orange confetti splashes around the champion avatar. */
function Confetti() {
  return (
    <svg className="fl__confetti" viewBox="0 0 120 90" aria-hidden="true">
      <circle cx="14" cy="30" r="4" fill="#ff8f2c" />
      <circle cx="104" cy="26" r="5" fill="#ffa94d" />
      <rect x="24" y="8" width="7" height="7" rx="2" transform="rotate(20 24 8)" fill="#ffb765" />
      <rect x="92" y="52" width="6" height="6" rx="2" transform="rotate(35 92 52)" fill="#ff8f2c" />
      <path d="M60 4l2.2 4.5 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z" fill="#ffc27a" />
      <circle cx="46" cy="16" r="2.5" fill="#ff8f2c" />
      <circle cx="78" cy="14" r="3" fill="#ffb765" />
    </svg>
  );
}

/* ------------------------------ podium ---------------------------------- */
function PodiumColumn({ entry, rank }: { entry: RankingEntry | undefined; rank: 1 | 2 | 3 }) {
  // The user's own avatar comes from /users/me, not from the standings row.
  const me = useAuthOptional()?.me ?? null;
  const { t } = useTranslation();
  if (!entry) {
    return <div className={`fl__col fl__col--r${rank}`} aria-hidden="true"><div className={`fl__block fl__block--r${rank} is-empty`} /></div>;
  }
  const name = displayName(entry, t("home.defaultNickname"));
  return (
    <div className={`fl__col fl__col--r${rank}`} aria-label={t("friendLeague.podiumA11y", { rank, name, points: entry.points })}>
      {rank === 1 && (
        <div className="fl__champion">
          <Confetti />
          <span className="fl__champion-avatar">
            <RankAvatar entry={withSelfProfile(entry, me)} size={62} />
          </span>
        </div>
      )}
      <div className={`fl__block fl__block--r${rank}`}>
        <span className="fl__block-rank">{rank}</span>
        <span className="fl__block-name">{name}</span>
      </div>
    </div>
  );
}

function FriendLeagueHero({ top3 }: { top3: RankingEntry[] }) {
  return (
    <div className="fl__hero">
      <PlaceholderAvatar className="fl__decor--left" />
      <PlaceholderAvatar className="fl__decor--right" />
      <div className="fl__podiums">
        <PodiumColumn entry={top3[1]} rank={2} />
        <PodiumColumn entry={top3[0]} rank={1} />
        <PodiumColumn entry={top3[2]} rank={3} />
      </div>
      <div className="fl__platform" aria-hidden="true" />
    </div>
  );
}

/* ---------------------------- ranking list ------------------------------ */
function FriendRow({ entry, meId }: { entry: RankingEntry; meId?: string }) {
  const me = useAuthOptional()?.me ?? null;
  const { t } = useTranslation();
  const tierLabel = useTierLabel();
  const isMe = entry.user_id === meId;
  const name = displayName(entry, t("home.defaultNickname"));
  const league = tierLabel(entry.tier);
  const medal = entry.rank <= 3;
  return (
    <li
      className={`fl__row ${isMe ? "is-me" : ""}`}
      aria-current={isMe ? "true" : undefined}
      aria-label={t("friendLeague.rowA11y", {
        rank: entry.rank,
        name,
        league: league ? t("friendLeague.leagueSuffix", { league }) : "",
        points: entry.points,
        me: isMe ? t("friendLeague.meSuffix") : "",
      })}
    >
      {/* LEG-010 437:7896 — rank, 50px avatar and the 181-wide name block are
          one 22px-gap group; the medal and points sit at the right edge. */}
      <span className="fl__row-main">
        <span className="fl__row-no">{entry.rank}</span>
        <span className="fl__row-avatar">
          <RankAvatar entry={withSelfProfile(entry, me)} size={50} />
        </span>
        <span className="fl__row-text">
          <span className="fl__row-name">{name}</span>
          {/* LEG-010 keeps the tier line in every row and writes "-" when the
              friend is in no league (437:8280) — dropping the line re-centres
              the name and makes those rows sit differently from the rest. */}
          <span className="fl__row-league">{league || "-"}</span>
        </span>
      </span>
      <span className="fl__row-right">
        {medal && <MedalIcon rank={entry.rank} size={22} />}
        <span className="fl__row-pts">{entry.points}P</span>
      </span>
    </li>
  );
}

/* ------------------------------- screen --------------------------------- */
export function FriendLeague() {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);
  // Refetch on (re)entry + when the tab regains focus so eligibility refreshes
  // after the user returns from friend search / management.
  const q = useQuery({
    queryKey: ["league-rankings", "friend"],
    queryFn: gameApi.friendRankings,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  return (
    <>
      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        skeleton={<SkeletonList rows={6} height={64} />}
      >
        {(data) => {
          const entries = data.entries;
          const meId = data.me?.user_id;
          // The caller is always a participant; fewer than 2 = no eligible friends.
          if (entries.length < 2) {
            return <FriendLeagueEmptyState onAdd={() => setAddOpen(true)} />;
          }
          return (
            <div className="fl">
              <FriendLeagueHero top3={entries.slice(0, 3)} />
              <ul className="fl__ranks" role="list" aria-label={t("friendLeague.rankingAria")}>
                {entries.map((entry) => (
                  <FriendRow key={entry.user_id} entry={entry} meId={meId} />
                ))}
              </ul>
            </div>
          );
        }}
      </Async>
      {/* Add Friend opens as a bottom sheet on this page — no navigation away. */}
      <AddFriendSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
