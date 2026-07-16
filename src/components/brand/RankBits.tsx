/**
 * Shared ranking-row bits used by both the Regular League and Friend League
 * screens: the tier-tinted medal (ranks 1–3) and the real/fallback avatar.
 */
import { Avatar } from "../ui/kit";
import { CharacterArt, avatarBg, type AvatarKey } from "./ProfileAssets";
import type { RankingEntry } from "../../lib/types";

export function MedalIcon({ rank, size = 27 }: { rank: number; size?: number }) {
  const fill = rank === 1 ? "#f5c518" : rank === 2 ? "#c4ccd4" : "#e08a4a";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
}

/** Real avatar for a ranking row: uploaded photo → character → initial fallback. */
export function RankAvatar({ entry, size = 46 }: { entry: RankingEntry; size?: number }) {
  if (entry.profile_image_type === "CUSTOM" && entry.profile_image_url) {
    return <Avatar url={entry.profile_image_url} name={entry.nickname} size={size} />;
  }
  if (entry.profile_image_type === "AVATAR" && entry.avatar_key) {
    const key = entry.avatar_key as AvatarKey;
    return (
      <span
        className="rank-avatar-char"
        style={{ width: size, height: size, background: avatarBg(key) }}
        aria-hidden="true"
      >
        <CharacterArt variant={key} fill="82%" />
      </span>
    );
  }
  return <Avatar name={entry.nickname} size={size} />;
}
