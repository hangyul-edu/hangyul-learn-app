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
import { PlusIcon } from "../components/PlusIcon";
import drop1232 from "../assets/brand/fl-podium-drop1232.svg";
import drop1233 from "../assets/brand/fl-podium-drop1233.svg";
import drop1235 from "../assets/brand/fl-podium-drop1235.svg";
import drop1236 from "../assets/brand/fl-podium-drop1236.svg";
import strip1 from "../assets/brand/fl-podium-strip1.svg";
import strip2 from "../assets/brand/fl-podium-strip2.svg";
import strip3 from "../assets/brand/fl-podium-strip3.svg";

/** "Green League" / "Green 리그" — the suffix differs per language. */
const useTierLabel = () => {
  const { t } = useTranslation();
  return (tier?: string | null) => {
    const meta = tier ? TIER_META[tier as LeagueTier] : undefined;
    return meta ? t("league.tierLabel", { tier: meta.name }) : undefined;
  };
};
const displayName = (e: RankingEntry, fallback: string) => e.nickname ?? fallback;

/* ------------------------------ empty state ----------------------------- */
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

/* ------------------------------ podium ---------------------------------- */
/* LEG-010 (KO 1:4259 / EN 798:77164). The hero is the 375x270 white band
   under the tab row (393:17092), drawn on a fixed 375-wide stage centred on
   the screen so every piece keeps the frame's coordinates (frame y minus the
   92px status bar + tab row):
   - the three blocks overlap, 1st on top — 2nd 86x98 #FFD166 at (72,165),
     1st 76x145 #FF9900 at (150,118), 3rd 90x77 #A8DADC at (213,186) — each
     with its darker right-hand strip (the Figma "Intersect" exports), on a
     261x17 #D9D9D9 base at (57,253);
   - the champion's 80px avatar at (148,30) with the four orange drops;
   - the 2nd and 3rd friends' own 60px avatars standing on their blocks at
     (84,98) and (231,118). The EN frame shows them with each friend's
     character; the KO frame's grey discs are the same avatar with no picture
     (DefaultProfile), not decoration. */
const DROPS = [
  // node, src, wrapper box, inner box + transform, img inset — as exported.
  { id: "1233", src: drop1233, box: [228, 20, 21.422, 22.577], inner: [18.236, 19.666, "scaleY(-1) rotate(-169.83deg)"], inset: "-1.18% -15.57% -9.7% -1.28%" },
  { id: "1232", src: drop1232, box: [126, 35, 13.964, 15.36], inner: null, inset: "-1.51% -20.33% -12.42% -1.67%" },
  { id: "1236", src: drop1236, box: [126.3, 65.95, 13.805, 13.264], inner: [10.418, 11.236, "rotate(-72.88deg)"], inset: "-2.06% -27.25% -16.99% -2.24%" },
  { id: "1235", src: drop1235, box: [226, 96, 21.443, 20.462], inner: [16.774, 18.089, "scaleY(-1) rotate(-76.79deg)"], inset: "-1.28% -16.93% -10.55% -1.39%" },
] as const;

function Drop({ drop }: { drop: (typeof DROPS)[number] }) {
  const [left, top, width, height] = drop.box;
  // The export pads each vector for its blur filter; the inset lets that
  // padding spill out of the node box exactly as Figma lays it out.
  const img = (
    <span className="fl__drop-fit" style={{ inset: drop.inset }}>
      <img src={drop.src} alt="" />
    </span>
  );
  return (
    <span className="fl__drop" style={{ left, top, width, height }}>
      {drop.inner ? (
        <span className="fl__drop-turn" style={{ width: drop.inner[0], height: drop.inner[1], transform: drop.inner[2] }}>
          {img}
        </span>
      ) : (
        img
      )}
    </span>
  );
}

const STRIPS = { 1: strip1, 2: strip2, 3: strip3 } as const;

function PodiumPlace({ entry, rank }: { entry: RankingEntry | undefined; rank: 1 | 2 | 3 }) {
  // The user's own avatar comes from /users/me, not from the standings row.
  const me = useAuthOptional()?.me ?? null;
  const { t } = useTranslation();
  if (!entry) {
    // Only two of you so far: the 3rd block stands empty.
    return <span className={`fl__block fl__block--r${rank} is-empty`} aria-hidden="true" />;
  }
  const name = displayName(entry, t("home.defaultNickname"));
  return (
    <div className={`fl__place fl__place--r${rank}`} aria-label={t("friendLeague.podiumA11y", { rank, name, points: entry.points })}>
      <span className={`fl__block fl__block--r${rank}`} aria-hidden="true">
        <img className="fl__strip" src={STRIPS[rank]} alt="" />
        <span className="fl__block-rank">{rank}</span>
        <span className="fl__block-name">{name}</span>
      </span>
      <span className={`fl__podium-avatar fl__podium-avatar--r${rank}`} aria-hidden="true">
        <RankAvatar entry={withSelfProfile(entry, me)} size={rank === 1 ? 80 : 60} />
      </span>
    </div>
  );
}

function FriendLeagueHero({ top3 }: { top3: RankingEntry[] }) {
  return (
    <div className="fl__hero">
      <div className="fl__stage">
        {/* Figma order: 2nd and 3rd under the 1st, then the base, then the avatars. */}
        <PodiumPlace entry={top3[1]} rank={2} />
        <PodiumPlace entry={top3[2]} rank={3} />
        <PodiumPlace entry={top3[0]} rank={1} />
        <span className="fl__platform" aria-hidden="true" />
        <span className="fl__drops" aria-hidden="true">
          {DROPS.map((drop) => (
            <Drop key={drop.id} drop={drop} />
          ))}
        </span>
      </div>
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
