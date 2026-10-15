import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../../api/endpoints";
import { ProfilePlaceholder, avatarBg, characterArtSrc, characterArtStyle, type AvatarKey } from "../../components/brand/ProfileAssets";
import { useTranslation } from "../../i18n";
import type { Me } from "../../lib/types";
/* MOR-001's own nickname chevron, exported from ic_16_arrow 1:5563 — 6x10.5,
   right-pointing, stroked #262C31. Not the 6.5x11.5 ic-16-chevron. */
import icNickArrow from "../../assets/brand/ic-16-arrow-right-dark.svg";
import statTotalDays from "../../assets/brand/stat-total-days.svg";
import statBestStreak from "../../assets/brand/stat-best-streak.svg";
import statCurrentStreak from "../../assets/brand/stat-current-streak.svg";

/**
 * The More-page avatar. `me` (from /users/me, which EditProfile writes through
 * `setMe`) is the single source of truth, so whatever was picked in Profile
 * Management shows here — there is no separate default kept on this screen.
 * The character is ink-centred and per-character sized for the 60px disc, the
 * same way the AME-006 picker does it.
 */
function ProfileAvatar({ me }: { me: Me | null }) {
  if (me?.profile_image_type === "CUSTOM" && me.profile_image_url)
    return <img className="more__avatar-img" src={me.profile_image_url} alt="" />;
  if (me?.profile_image_type === "AVATAR" && me.avatar_key) {
    const key = me.avatar_key as AvatarKey;
    return <img src={characterArtSrc(key)} alt="" style={characterArtStyle(key, MORE_AVATAR)} />;
  }
  return <ProfilePlaceholder />;
}

/** Figma 1:5560 — the More page draws the avatar disc at 60px. */
const MORE_AVATAR = 60;

/** A character carries its own tint; only the no-image state uses the Gray 2 disc. */
function avatarDiscStyle(me: Me | null) {
  return me?.profile_image_type === "AVATAR" && me.avatar_key
    ? { background: avatarBg(me.avatar_key as AvatarKey) }
    : undefined;
}

/**
 * Stat icons — the real emoji artwork exported from MOR-001_더보기메인
 * (📒 노트 1:5569, 🌤️ 작은 구름 뒤의 태양 1:5587, 🏅 스포츠 메달 1:5604).
 * Rendered at Figma's 16px.
 */
const STAT_ART: Record<StatKind, string> = {
  total: statTotalDays,
  best: statBestStreak,
  current: statCurrentStreak,
};

type StatKind = "total" | "best" | "current";

function StatIcon({ kind }: { kind: StatKind }) {
  return <img className="more__stat-icon" src={STAT_ART[kind]} alt="" aria-hidden="true" />;
}

/** One of the three streak figures: its icon, label and "N일" (or "-"). */
function Stat({ kind, label, days }: { kind: StatKind; label: string; days: number | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="more__stat">
      <StatIcon kind={kind} />
      <span className="more__stat-label">{label}</span>
      <span className="more__stat-val">{days != null ? t("more.daysSuffix", { n: days }) : "-"}</span>
    </div>
  );
}

/** The profile summary card: avatar, nickname (→ Profile Management) and the streak stats. */
export function ProfileSummary({ me }: { me: Me | null }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const streak = useQuery({ queryKey: ["streak"], queryFn: dashboardApi.streak });
  const nickname = me?.nickname ?? me?.name ?? t("home.defaultNickname");
  return (
    <section className="more__profile">
      <div className="more__avatar" style={avatarDiscStyle(me)}>
        <ProfileAvatar me={me} />
      </div>
      <button className="more__nick" onClick={() => nav("/profile/edit")} aria-label={t("more.editProfile")}>
        <span className="more__nick-name">{nickname}</span>
        <img className="more__nick-arrow" src={icNickArrow} alt="" aria-hidden="true" />
      </button>

      <div className="more__divider" />

      {/* MOR-001_더보기메인 (1:5582) shows 총 학습일 / "Total Study Days" first. */}
      <div className="more__stats">
        <Stat kind="total" label={t("more.totalStudyDays")} days={streak.data?.total_days} />
        <Stat kind="best" label={t("more.bestStreak")} days={streak.data?.best} />
        <Stat kind="current" label={t("more.currentStreak")} days={streak.data?.current} />
      </div>
    </section>
  );
}
