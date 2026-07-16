/**
 * Inline SVG art for the Regular League guide sheet. The repo ships no raster
 * assets (brand visuals are built as inline SVG — see ProfileAssets.tsx), so
 * the hero banner, schedule medal, reward-card glyphs, and promotion swords are
 * drawn here to match the reference composition.
 */
import type { RewardIconKind } from "../../lib/league";

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
      {/* crossed-swords emblem (two swords crossed in an X) */}
      <g transform="translate(64 66)">
        <use href="#lgSword" transform="rotate(42)" />
        <use href="#lgSword" transform="rotate(-42)" />
      </g>
    </svg>
  );
}

/* ---------------------------- schedule medal ---------------------------- */
export function ScheduleMedal() {
  return (
    <svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="lgMedal" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#ffde84" />
          <stop offset="1" stopColor="#f5b02a" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill="url(#lgMedal)" />
      <circle cx="24" cy="24" r="18" fill="none" stroke="#e79a1c" strokeWidth="2" />
      <path d="M24 12l3.7 7.5 8.3 1.2-6 5.8 1.4 8.2L24 32l-7.4 3.9 1.4-8.2-6-5.8 8.3-1.2L24 12z" fill="#fff6df" />
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

/* ----------------------------- crossed swords --------------------------- */
export function CrossedSwords() {
  return (
    <svg viewBox="0 0 48 48" width="32" height="32" aria-hidden="true" focusable="false">
      <g stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round">
        <path d="M14 14l20 20" />
        <path d="M34 14L14 34" />
      </g>
      <g stroke="#e4fbfb" strokeWidth="3.4" strokeLinecap="round">
        <path d="M11 12l5 5M37 12l-5 5" />
      </g>
    </svg>
  );
}
