/**
 * Inline SVG art for the Regular League guide sheet. The repo ships no raster
 * assets (brand visuals are built as inline SVG — see ProfileAssets.tsx), so
 * the hero banner, schedule medal, reward-card glyphs, and promotion swords are
 * drawn here to match the reference composition.
 */
import { TIER_CITRUS, type LeagueTier, type RewardIconKind } from "../../lib/league";

/* ------------------------------ hero banner ----------------------------- */
export function GuideBanner() {
  return (
    <svg viewBox="0 0 128 150" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="lgBannerClip">
          <path d="M30 26h68v82l-34-16-34 16z" />
        </clipPath>
        {/* One sword, pointing up (tip at y=-32, hilt at y=+20). */}
        <g id="lgSword">
          <path d="M0 -32 L3.4 8 L-3.4 8 Z" fill="#eef2f6" stroke="#b7c0ca" strokeWidth="1" strokeLinejoin="round" />
          <path d="M0 -30v36" stroke="#c7ced6" strokeWidth="0.9" />
          <rect x="-10" y="7.5" width="20" height="4.5" rx="2.2" fill="#c9902f" />
          <rect x="-2.4" y="11" width="4.8" height="11" rx="2.2" fill="#7a5326" />
          <circle cx="0" cy="23.5" r="3.2" fill="#c9902f" />
        </g>
      </defs>
      {/* soft ground shadow to the right/below */}
      <ellipse cx="70" cy="126" rx="42" ry="9" fill="rgba(120,60,10,0.28)" />
      {/* top rod + caps */}
      <rect x="16" y="18" width="96" height="10" rx="5" fill="#d7dce1" />
      <circle cx="18" cy="23" r="8.5" fill="#c3c9d1" />
      <circle cx="110" cy="23" r="8.5" fill="#c3c9d1" />
      {/* banner body with vertical cream/yellow stripes */}
      <g clipPath="url(#lgBannerClip)">
        <rect x="30" y="26" width="17" height="90" fill="#fff2cf" />
        <rect x="47" y="26" width="17" height="90" fill="#ffd75e" />
        <rect x="64" y="26" width="17" height="90" fill="#fff2cf" />
        <rect x="81" y="26" width="17" height="90" fill="#ffd75e" />
      </g>
      <path d="M30 26h68v82l-34-16-34 16z" fill="none" stroke="#f2c246" strokeWidth="2" />
      {/* white central medal disc with a thin dashed orange ring */}
      <circle cx="64" cy="66" r="25" fill="#fffdf6" />
      <circle cx="64" cy="66" r="21" fill="none" stroke="#f0a23a" strokeWidth="1.4" strokeDasharray="3 3.4" />
      {/* crossed-swords emblem (two swords crossed in an X) */}
      <g transform="translate(64 66)">
        <use href="#lgSword" transform="rotate(42)" />
        <use href="#lgSword" transform="rotate(-42)" />
      </g>
    </svg>
  );
}

/* ------------------------------ citrus badge ---------------------------- */
/** Neutral palette for an unknown tier or a not-yet-reached ("locked") tier. */
const CITRUS_LOCKED = { rind: "#b4b0a8", fill: "#cdcac2", flesh: "#e9e7e1" };

/**
 * The official league tier image: a colourful segmented citrus badge
 * (green → golden). Used everywhere a league tier is shown — the guide, the
 * League carousel, league results, and league history.
 *
 * - `locked` renders a greyed-out fruit with a padlock (future/unreached tiers).
 * - `label` makes it an accessible `img`; otherwise it is decorative.
 * - `className` lets callers size it (the square 0–64 viewBox scales to fit).
 */
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
  const c = locked ? CITRUS_LOCKED : (TIER_CITRUS[tier as LeagueTier] ?? CITRUS_LOCKED);
  const leaf = locked ? "#b4b0a8" : "#7cc44a";
  const leafDark = locked ? "#a09c94" : "#63ac39";
  const cx = 32;
  const cy = 37;
  const r = 15.5;
  const segments = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return `M${cx} ${cy}L${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const, focusable: false as const };
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" className={className} {...a11y}>
      <ellipse cx="33" cy="58" rx="17" ry="3.4" fill="rgba(120,80,10,0.14)" />
      {/* leaf + sprig at the top */}
      <path d="M32 15c1-6 7-9 12.5-8 0.2 6.4-5.2 10.4-12 10z" fill={leaf} />
      <path d="M31 18c-2.4-1-4-3.2-4-5.8 3.4 0.2 5.6 2.6 5.4 5.8z" fill={leafDark} />
      {/* rind (thick coloured outline) → body → segmented flesh */}
      <circle cx={cx} cy={cy} r="20" fill={c.rind} />
      <circle cx={cx} cy={cy} r="17.4" fill={c.fill} />
      <circle cx={cx} cy={cy} r={r} fill={c.flesh} />
      <path d={segments} stroke={c.fill} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="2.1" fill={c.fill} />
      {/* soft top-left highlight */}
      <ellipse cx="25.5" cy="30.5" rx="5.4" ry="3" fill="#ffffff" opacity="0.5" />
      {locked && (
        <g>
          <rect x="25.5" y="35" width="13" height="10" rx="2.2" fill="#8f8b83" />
          <path d="M28 35v-2.4a4 4 0 018 0V35" stroke="#8f8b83" strokeWidth="2" fill="none" />
          <circle cx="32" cy="40" r="1.7" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

/* --------------------------- reward-card icons -------------------------- */
const YELLOW = "#ffd23f";
const YELLOW_EDGE = "#f0b400";

function StarGlyph() {
  return <path d="M24 9l4.6 9.3 10.3 1.5-7.4 7.2 1.7 10.2L24 42.4l-9.2 4.9 1.7-10.2-7.4-7.2 10.3-1.5L24 9z" fill={YELLOW} stroke={YELLOW_EDGE} strokeWidth="1.5" strokeLinejoin="round" />;
}
function FlagGlyph() {
  return (
    <>
      <path d="M16 8v34" stroke={YELLOW_EDGE} strokeWidth="3" strokeLinecap="round" />
      <path d="M18 10c6-3 12 3 18 0v14c-6 3-12-3-18 0z" fill={YELLOW} stroke={YELLOW_EDGE} strokeWidth="1.5" strokeLinejoin="round" />
    </>
  );
}
function PlayGlyph() {
  return <path d="M19 15l16 9-16 9z" fill={YELLOW} stroke={YELLOW_EDGE} strokeWidth="1.6" strokeLinejoin="round" />;
}
function BookGlyph() {
  return (
    <>
      <path d="M24 15c-4-3-9-3-13-2v20c4-1 9-1 13 2 4-3 9-3 13-2V13c-4-1-9-1-13 2z" fill={YELLOW} stroke={YELLOW_EDGE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M24 15v22" stroke={YELLOW_EDGE} strokeWidth="1.5" />
    </>
  );
}

export function RewardIcon({ kind }: { kind: RewardIconKind }) {
  const glyph =
    kind === "attendance" ? <StarGlyph /> : kind === "learning" ? <FlagGlyph /> : kind === "course" ? <PlayGlyph /> : <BookGlyph />;
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true" focusable="false">
      {glyph}
    </svg>
  );
}
