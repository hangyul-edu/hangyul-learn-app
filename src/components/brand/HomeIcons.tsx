/**
 * Inline SVG icons for the Home screen + bottom navigation. The repo ships no
 * branded raster/vector nav or dashboard icons (the previous UI used emoji), so
 * these are original, reusable vector components matching the reference palette.
 */

export function BellIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M6 9a6 6 0 0 1 12 0c0 4 1.2 5.6 2 6.5.5.6.1 1.5-.7 1.5H4.7c-.8 0-1.2-.9-.7-1.5C4.8 14.6 6 13 6 9z"
        stroke="#FFB91F"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9.5 20a2.5 2.5 0 0 0 5 0" stroke="#FFB91F" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The daily-learning sun. `lit` is the only difference between states: ON is
 * the warm peach/orange/yellow palette, OFF is a flat neutral gray. Both states
 * render the identical geometry at the identical size — no layout shift when it
 * toggles. Defaults to lit so existing decorative uses are unaffected.
 */
export function SunIcon({ size = 82, lit = true }: { size?: number; lit?: boolean }) {
  const rayStroke = lit ? "#FFC97A" : "#D8DDE1";
  const faceFill = lit ? "#FFC13B" : "#CDD3D8";
  const featureStroke = lit ? "#7A4A12" : "#8A929A";
  const rays = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rays.push(
      <line
        key={i}
        x1={50 + Math.cos(a) * 30}
        y1={50 + Math.sin(a) * 30}
        x2={50 + Math.cos(a) * 42}
        y2={50 + Math.sin(a) * 42}
        stroke={rayStroke}
        strokeWidth="6"
        strokeLinecap="round"
      />,
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {rays}
      <circle cx="50" cy="50" r="26" fill={faceFill} />
      {lit && <circle cx="50" cy="50" r="26" fill="url(#sunSheen)" />}
      <circle cx="43" cy="47" r="2.6" fill={featureStroke} />
      <circle cx="57" cy="47" r="2.6" fill={featureStroke} />
      <path d="M43 56c2.5 3 9 3 12 0" stroke={featureStroke} strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <defs>
        <radialGradient id="sunSheen" cx="0.38" cy="0.34" r="0.7">
          <stop offset="0" stopColor="#FFE39A" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#FFE39A" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/** Orange side-profile head with speech lines (conversation). */
export function SpeakingIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M40 15c-11 0-20 8-20 18 0 4 1.6 7.7 4.3 10.6-.5 3.2-2 6-4 7.9-.6.6-.2 1.6.6 1.6 4.2 0 8-1.5 10.9-3.9 2.5.9 5.3 1.4 8.2 1.4 11 0 20-8 20-18S51 15 40 15z"
        fill="#FF5B00"
      />
      <circle cx="34" cy="33" r="2.4" fill="#fff" />
      <circle cx="42" cy="33" r="2.4" fill="#fff" />
      <path d="M50 24c3 2 4.6 5 4.6 9M55 20c4 3 6 7 6 13" stroke="#FF5B00" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Small colorful pencil (TOPIK). */
export function PencilIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <g transform="rotate(20 24 28)">
        <rect x="18" y="9" width="12" height="29" rx="2" fill="#5AA9F4" />
        <rect x="18" y="9" width="12" height="6" rx="2" fill="#F58BB0" />
        <path d="M18 38h12l-6 9z" fill="#F4C542" />
        <path d="M21.2 42.5h5.6l-2.8 4.5z" fill="#2C333B" />
      </g>
    </svg>
  );
}

/** Muted gear (third learning mode, shown inactive in the reference). */
export function GearIcon({ size = 28, color = "#AEB7BD" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 3.5l1.4 2.1 2.5-.5.5 2.5 2.1 1.4-1.2 2.2 1.2 2.2-2.1 1.4-.5 2.5-2.5-.5L12 20.5l-1.4-2.1-2.5.5-.5-2.5-2.1-1.4L6.7 12 5.5 9.8l2.1-1.4.5-2.5 2.5.5L12 3.5z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

export function PlayIcon({ size = 34, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 7.5v9l7-4.5-7-4.5z" fill={color} />
    </svg>
  );
}

/** Yellow-orange book (review). */
export function BookIcon({ size = 62 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="14" y="10" width="36" height="44" rx="5" fill="#FFB13B" />
      <rect x="14" y="10" width="8" height="44" rx="4" fill="#F58A2E" />
      <rect x="27" y="18" width="17" height="12" rx="2.5" fill="#fff" />
      <path d="M30 34h11M30 40h11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRight({ size = 20, color = "#C4CBD1" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* --------------------------- Bottom-nav icons --------------------------- */

export function NavHome({ active }: { active: boolean }) {
  const c = active ? "#FF5B00" : "#AEB7BD";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11l8-6.5 8 6.5" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9h12v-9" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavLecture({ active }: { active: boolean }) {
  const c = active ? "#FF5B00" : "#AEB7BD";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="6" width="17" height="12.5" rx="2.4" stroke={c} strokeWidth="1.9" />
      <path d="M3.8 9.2h16.4M8 6l-1 3.2M13 6l-1 3.2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function NavFlag({ active }: { active: boolean }) {
  const c = active ? "#FF5B00" : "#AEB7BD";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 21V4" stroke={c} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M6 5h11l-2.2 3.2L17 11.5H6" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function NavMedal({ active }: { active: boolean }) {
  const c = active ? "#FF5B00" : "#AEB7BD";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 3l2.5 6M16 3l-2.5 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15" r="5.4" stroke={c} strokeWidth="1.9" />
      <path d="M12 12.6l.8 1.6 1.7.2-1.25 1.2.3 1.7-1.55-.85-1.55.85.3-1.7L9.5 14.4l1.7-.2.8-1.6z" fill={c} />
    </svg>
  );
}

export function NavMore({ active }: { active: boolean }) {
  const c = active ? "#FF5B00" : "#AEB7BD";
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.9" />
      <circle cx="8" cy="12" r="1.3" fill={c} />
      <circle cx="12" cy="12" r="1.3" fill={c} />
      <circle cx="16" cy="12" r="1.3" fill={c} />
    </svg>
  );
}

/** Save / bookmark control — a plus in a circle. Filled orange when saved. */
export function SavePlusIcon({ active = false }: { active?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle
        cx="12"
        cy="12"
        r="10.5"
        fill={active ? "#FF5B00" : "none"}
        stroke={active ? "#FF5B00" : "#C4CBD1"}
        strokeWidth="1.6"
      />
      <path
        d="M12 7.4v9.2M7.4 12h9.2"
        stroke={active ? "#fff" : "#8A929A"}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
