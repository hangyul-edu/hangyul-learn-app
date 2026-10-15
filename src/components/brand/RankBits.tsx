/**
 * Shared ranking-row bits used by both the Regular League and Friend League
 * screens: the podium medal (ranks 1–3) and the real/fallback avatar.
 */
import { Avatar } from "../ui/kit";
import profileDefault from "../../assets/brand/profile-default.svg";
import leagueMedal from "../../assets/brand/league-medal.svg";
import { avatarBg, characterArtSrc, characterArtStyle, type AvatarKey } from "./ProfileAssets";

/** Any profile-bearing subject (RankingEntry, Friend, FriendRequest, …). */
export interface AvatarSubject {
  user_id?: string;
  nickname?: string | null;
  profile_image_type?: string;
  profile_image_url?: string | null;
  avatar_key?: string | null;
}

/**
 * Substitutes the signed-in user's own persisted profile into a list entry.
 *
 * Ranking/friend rows carry whatever the list endpoint last returned, so right
 * after a change in Profile Management the user's OWN row would keep showing
 * the old avatar until that endpoint is refetched. `me` (from /users/me, which
 * EditProfile writes through `setMe`) is the single source of truth, so it wins
 * for the row that is the user. Everyone else's row is untouched.
 *
 * This is a plain function rather than a hook inside `RankAvatar` because
 * `RankAvatar` also renders on unauthenticated routes (InviteLanding), where
 * `useAuth()` throws.
 */
export function withSelfProfile<T extends AvatarSubject>(
  entry: T,
  me: { user_id: string; profile_image_type?: string; profile_image_url?: string | null; avatar_key?: string | null } | null,
): T {
  if (!me || !entry.user_id || entry.user_id !== me.user_id) return entry;
  return {
    ...entry,
    profile_image_type: me.profile_image_type,
    profile_image_url: me.profile_image_url,
    avatar_key: me.avatar_key,
  };
}

/**
 * Podium medal for ranks 1-3 — Figma LEG-002 groups 437:8282 / 8287 / 8292.
 * All three export byte-identical artwork (one gold medal on a red ribbon,
 * 17.02x22), so the design does NOT tint it gold/silver/bronze; `rank` is only
 * used by callers to decide whether a medal shows at all.
 */
export function MedalIcon({ size = 22 }: { rank?: number; size?: number }) {
  return (
    <img
      className="rank-medal"
      src={leagueMedal}
      alt=""
      aria-hidden="true"
      style={{ width: (size * 17.0224) / 22, height: size, display: "block" }}
    />
  );
}

/** Real avatar for a ranking row: uploaded photo → character → initial fallback. */
export function RankAvatar({ entry, size = 50 }: { entry: AvatarSubject; size?: number }) {
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
        {/* Ink-centred and per-character sized, exactly as the AME-006 picker
            does it — a single `fill` percentage mis-scales two of the three
            characters and leaves them visibly off-centre. */}
        <img src={characterArtSrc(key)} alt="" style={characterArtStyle(key, size)} />
      </span>
    );
  }
  return <DefaultProfile size={size} />;
}

/**
 * Figma's no-image profile avatar (btn_profileimg, node I960:23332;8601:64557):
 * a Gray 2 disc with the exported gray character glyph inset at 25% / 18.75%.
 * Used wherever a user has no photo or chosen character.
 */
export function DefaultProfile({ size = 50 }: { size?: number }) {
  return (
    <span
      className="rank-avatar-char"
      style={{ width: size, height: size, background: "var(--border)" }}
      aria-hidden="true"
    >
      <img
        src={profileDefault}
        alt=""
        className="rank-avatar__placeholder"
      />
    </span>
  );
}
