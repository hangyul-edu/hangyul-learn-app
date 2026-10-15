import sunArt from "../../assets/brand/home-sun.svg";
import lectureArt from "../../assets/brand/home-lecture.svg";
import reviewArt from "../../assets/brand/home-review.svg";
import bellArt from "../../assets/brand/ic-24-bell.svg";
import topNavChevronArt from "../../assets/brand/ic-12-chevron.svg";
import topNavChevronGoldArt from "../../assets/brand/ic-12-chevron-gold.svg";
/**
 * Icons for the Home screen + bottom navigation, all sourced from Figma.
 *
 * Artwork whose colour is fixed (the sun, the bell, the shortcut tiles, the
 * chevrons) is an exported asset. The five bottom-nav glyphs are inline paths
 * because they tint per active/inactive state, but the path data, stroke width
 * and 24px placement below are copied verbatim from the ic_24_* exports — do
 * not redraw them; re-export from navi_user if the design changes.
 */

/**
 * Notification bell — artwork exported from Figma MAI-001 "ic_24_bell"
 * (node 1825:26660). The export also carries the unread badge as a baked-in
 * circle; that dot is state-driven, so it is stripped from the asset and drawn
 * by `.home__bell-dot` at the same place (cx 22, cy 3, r 2, Brand color 1).
 */
export function BellIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      src={bellArt}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="home-ic"
    />
  );
}

/**
 * The 12px top-nav chevron — Figma "ic_B_topNav". The export points LEFT and
 * every placement in the file mirrors it, hence the scaleX. Figma ships the
 * component in two tones: Gray 4 on light surfaces (1825:26656) and Brand
 * yellow on the black promo toast (1825:26634); both are real exports rather
 * than one recoloured drawing.
 */
export function TopNavChevron({ size = 12, tone = "gray" }: { size?: number; tone?: "gray" | "gold" }) {
  return (
    <img
      src={tone === "gold" ? topNavChevronGoldArt : topNavChevronArt}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="home-ic home-ic--mirrored"
    />
  );
}

/**
 * The daily-learning sun. `lit` is the only difference between states: ON is
 * the warm peach/orange/yellow palette, OFF is a flat neutral gray. Both states
 * render the identical geometry at the identical size — no layout shift when it
 * toggles. Defaults to lit so existing decorative uses are unaffected.
 */
/**
 * Daily-learning sun — artwork exported from Figma (MAI-001 "Subtract",
 * node 1825:26657). The unlit state desaturates the same asset instead of
 * using a second drawing, so both states track the source file.
 */
export function SunIcon({ size = 82, lit = true }: { size?: number; lit?: boolean }) {
  return (
    <img
      src={sunArt}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ display: "block", filter: lit ? undefined : "grayscale(1) opacity(0.55)" }}
    />
  );
}

/**
 * Home shortcut artwork, exported from Figma MAI-001. The lecture tile
 * (node 1825:26639) already contains its yellow card, so it must NOT be wrapped
 * in a hand-made coloured box. The review tile is the notebook (node 1825:26645).
 */
export function LectureShortcutArt() {
  return <img src={lectureArt} alt="" aria-hidden="true" className="home-ic home-ic--lecture" />;
}

export function ReviewShortcutArt({ size = 74 }: { size?: number }) {
  return <img src={reviewArt} alt="" aria-hidden="true" style={{ width: size, height: size, display: "block" }} />;
}

/* --------------------------- Bottom-nav icons --------------------------- */

/* ---------------------------------------------------------------------------
 * Bottom-navigation icons — geometry exported from Figma's ic_24_* set
 * (navi_user, node 1825:26629). Do not redraw these by hand; each glyph has its
 * own artwork box, centred in a 24x24 frame by the translate below.
 * ------------------------------------------------------------------------- */
const navColor = (active: boolean) => (active ? "var(--brand-500)" : "var(--ink-4)");

/** ic_24_home */
export function NavHome({ active }: { active: boolean }) {
  const c = navColor(active);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(2.9 2.576)">
        <path
          d="M6.43333 16.7474V12.7474C6.43333 12.1952 6.88105 11.7474 7.43333 11.7474H10.7667C11.319 11.7474 11.7667 12.1952 11.7667 12.7474V16.7474C11.7667 17.2997 12.2144 17.7474 12.7667 17.7474H16.1C16.6523 17.7474 17.1 17.2997 17.1 16.7474V8.475C17.1 8.19356 16.9814 7.92516 16.7733 7.73566L9.77333 1.36066C9.39171 1.01311 8.80829 1.01311 8.42667 1.36066L1.42667 7.73566C1.21859 7.92516 1.1 8.19356 1.1 8.475V16.7474C1.1 17.2997 1.54772 17.7474 2.1 17.7474H5.43333C5.98562 17.7474 6.43333 17.2997 6.43333 16.7474Z"
          stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/** ic_24_contents */
export function NavLecture({ active }: { active: boolean }) {
  const c = navColor(active);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(2.459 2.9)">
        <rect x="1.1" y="1.1" width="16.8817" height="16" rx="3" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" />
        <path d="M1.1 6.00714H17.9816" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" />
        <path d="M7.27135 1.9498C7.09105 1.36966 6.46206 0.996457 5.86647 1.11623C5.27088 1.236 4.93423 1.80338 5.11453 2.38352L6.19294 2.16666L7.27135 1.9498ZM6.23997 6.00463C6.42028 6.58477 7.04927 6.95797 7.64486 6.8382C8.24045 6.71843 8.5771 6.15105 8.39679 5.57091L7.31838 5.78777L6.23997 6.00463ZM6.19294 2.16666L5.11453 2.38352L6.23997 6.00463L7.31838 5.78777L8.39679 5.57091L7.27135 1.9498L6.19294 2.16666Z" fill={c} />
        <path d="M12.8416 1.9498C12.6613 1.36966 12.0323 0.996457 11.4368 1.11623C10.8412 1.236 10.5045 1.80338 10.6848 2.38352L11.7632 2.16666L12.8416 1.9498ZM11.8103 6.00463C11.9906 6.58477 12.6196 6.95797 13.2151 6.8382C13.8107 6.71843 14.1474 6.15105 13.9671 5.57091L12.8887 5.78777L11.8103 6.00463ZM11.7632 2.16666L10.6848 2.38352L11.8103 6.00463L12.8887 5.78777L13.9671 5.57091L12.8416 1.9498L11.7632 2.16666Z" fill={c} />
        <path d="M12.0884 10.3547L9.01435 8.49002C8.4812 8.16663 7.79945 8.55046 7.79945 9.17402V12.9033C7.79945 13.5269 8.4812 13.9107 9.01435 13.5873L12.0884 11.7227C12.6019 11.4112 12.6019 10.6661 12.0884 10.3547Z" fill={c} />
      </g>
    </svg>
  );
}

/** ic_24_flag */
export function NavFlag({ active }: { active: boolean }) {
  const c = navColor(active);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(3.547 2.867)">
        <path d="M1.1 17.1664V2.57816" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" />
        <path d="M4.47085 1.1C2.38229 1.1 1.3534 2.09134 1.10003 2.58701V12.5343C1.30932 12.0386 2.3492 11.0472 4.83435 11.0472C7.94078 11.0472 8.93593 13.5918 11.7743 13.7901C14.6126 13.9884 15.1451 12.9529 15.806 12.5343V2.1162C15.0432 2.98107 14.1537 4.07422 11.7743 4.07422C8.80001 4.07422 7.08156 1.1 4.47085 1.1Z"
          stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** ic_24_my */
export function NavMedal({ active }: { active: boolean }) {
  const c = navColor(active);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(3.9 1.4)">
        <path d="M4.1 20.1V12.1H12.1V20.1L8.1 18.6L4.1 20.1Z" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8.1" cy="8.1" r="7" fill="var(--surface)" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" />
        <circle cx="8.1" cy="8.1" r="3" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** ic_24_more */
export function NavMore({ active }: { active: boolean }) {
  const c = navColor(active);
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g transform="translate(1.9 1.9)">
        <circle cx="10.1" cy="10.1" r="9" stroke={c} strokeWidth="2.2" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="5.86471" cy="10.1" r="1.58824" fill={c} />
        <circle cx="10.1" cy="10.1" r="1.58824" fill={c} />
        <circle cx="14.3353" cy="10.1" r="1.58824" fill={c} />
      </g>
    </svg>
  );
}

