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
import tierLockedArt from "../../assets/brand/league-tier-locked.svg";
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
 * - `locked` swaps in the grey artwork for tiers not yet reached.
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

/**
 * The locked badge — Figma LEG-003 "리그 잠금" (959:20731), group 959:20888.
 *
 * A real export, not a treatment of the coloured art. The locked fruit is its
 * own drawing: grey rind and segments, and — this is the whole lock motif — a
 * **keyhole** where a reached tier has its plain round pith. There is no
 * padlock anywhere in the frame.
 *
 * One drawing for every locked tier. The design does not tint it per tier, and
 * it does not need to: the carousel shows the five tiers in a fixed order, so
 * position says which tier this is and the grey says you have not reached it.
 */
const LOCKED_ART = tierLockedArt;

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
  const art = locked ? LOCKED_ART : (TIER_ART[tier as LeagueTier] ?? TIER_ART.green);
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const };
  return (
    <span className={`citrus${locked ? " citrus--locked" : ""}${className ? ` ${className}` : ""}`} {...a11y}>
      <img className="citrus__art" src={art} alt="" aria-hidden="true" />
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
