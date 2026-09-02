/**
 * Artwork for the Regular League guide sheet and every tier badge, all exported
 * from Figma LEG-004 (2302:24646) and LEG-001 (893:24353). Nothing here is
 * redrawn — re-export from those frames if the design changes.
 */
import { type LeagueTier, type RewardIconKind } from "../../lib/league";
import tierGreenArt from "../../assets/brand/league-tier-green.svg";
import tierLimeArt from "../../assets/brand/league-tier-lime.svg";
import tierYellowArt from "../../assets/brand/league-tier-yellow.svg";
import tierOrangeArt from "../../assets/brand/league-tier-orange.svg";
import tierGoldenArt from "../../assets/brand/league-tier-golden.svg";
import guideBannerArt from "../../assets/brand/league-guide-banner.svg";
import rewardAttendanceArt from "../../assets/brand/league-reward-attendance.svg";
import rewardLearningArt from "../../assets/brand/league-reward-learning.svg";
import rewardCourseArt from "../../assets/brand/league-reward-course.svg";
import rewardReviewArt from "../../assets/brand/league-reward-review.svg";

/* ------------------------------ guide banner ---------------------------- */
/**
 * Hero pennant for the guide sheet — Figma LEG-004 Group 1410118218
 * (2302:27113): a striped banner with crossed swords hanging from a pole,
 * 135.43x217 sitting at x=208 and overhanging the orange band.
 */
export function GuideBanner() {
  return <img className="lgg__banner-art" src={guideBannerArt} alt="" aria-hidden="true" />;
}

/* ------------------------------ citrus badge ---------------------------- */
/**
 * The official league tier image: a colourful segmented citrus badge
 * (green → golden). Used everywhere a league tier is shown — the guide, the
 * League carousel, league results, and league history.
 *
 * - `locked` renders a greyed-out fruit with a padlock (future/unreached tiers).
 * - `label` makes it an accessible `img`; otherwise it is decorative.
 * - `className` lets callers size it (the square 0–64 viewBox scales to fit).
 */
/**
 * The five tier artworks, exported from the league carousel in Figma
 * LEG-001 (Frame 1410118315, node 893:24353): groups 893:24354 / 24430 / 24506
 * / 24581 / 24657, left to right. Each is a ~90-vector citrus with its own
 * rind, leaf, segment shading and highlights, so it is used as-is — there is no
 * meaningful way to redraw it.
 */
const TIER_ART: Record<LeagueTier, string> = {
  green: tierGreenArt,
  lime: tierLimeArt,
  yellow: tierYellowArt,
  orange: tierOrangeArt,
  golden: tierGoldenArt,
};

export function CitrusBadge({
  tier,
  locked = false,
  label,
  className,
}: {
  tier: string;
  locked?: boolean;
  label?: string;
  className?: string;
}) {
  const art = TIER_ART[tier as LeagueTier] ?? TIER_ART.green;
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };
  return (
    <span className={`citrus${locked ? " citrus--locked" : ""}${className ? ` ${className}` : ""}`} {...a11y}>
      <img className="citrus__art" src={art} alt="" aria-hidden="true" />
      {locked && (
        /* Padlock for tiers the player has not reached. Figma keeps the locked
           state as a separate hidden layer set rather than a flat asset, so the
           fruit is desaturated in CSS and the lock drawn over it. */
        <svg className="citrus__lock" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5.5" y="10" width="13" height="10" rx="2.2" fill="#8f8b83" />
          <path d="M8 10V7.6a4 4 0 018 0V10" stroke="#8f8b83" strokeWidth="2" fill="none" />
          <circle cx="12" cy="15" r="1.7" fill="#fff" />
        </svg>
      )}
    </span>
  );
}

/* --------------------------- reward-card icons -------------------------- */
/**
 * The four reward glyphs (Figma 2302:27533 / 27536 / 27549 / 27545) — a dashed
 * ring around a soft yellow star / flag / play / book, each 45px in the design.
 */
const REWARD_ART: Record<RewardIconKind, string> = {
  attendance: rewardAttendanceArt,
  learning: rewardLearningArt,
  course: rewardCourseArt,
  review: rewardReviewArt,
};

export function RewardIcon({ kind }: { kind: RewardIconKind }) {
  return <img className="lgg__reward-art" src={REWARD_ART[kind]} alt="" aria-hidden="true" />;
}
