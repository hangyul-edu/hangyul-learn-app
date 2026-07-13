/**
 * Profile-registration visuals — implemented as inline SVG because the repo
 * ships no raster/vector character or logo assets. The three characters reuse
 * the Hangyul tangerine mascot style (see AuthBrand) with distinct accessories
 * and background tints, matching the reference.
 */

/* -------------------- Large preview placeholder -------------------- */

/** White citrus mark shown inside the placeholder's inner circle. */
function WhiteMark({ size = 46 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M34 13c4-5 10-6 14-5 .5 3-.6 8.4-5.2 10.5-3.7 1.7-7 .3-7.9-.5-.8-1.5-1.2-3.2.9-5z" fill="#fff" />
      <ellipse cx="32" cy="39" rx="20" ry="18.5" fill="#fff" />
      <ellipse cx="32" cy="39" rx="20" ry="18.5" fill="#eef0f3" opacity="0.0" />
      <path d="M32 39l7-10M32 39l-9-6M32 39l3 11M32 39l-6-1" stroke="#d2d6db" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="32" cy="39" r="4.2" fill="#d2d6db" />
    </svg>
  );
}

/** Default circular profile preview: layered gray placeholder. */
export function ProfilePlaceholder() {
  return (
    <div className="setupp__placeholder" aria-hidden="true">
      <div className="setupp__placeholder-inner">
        <WhiteMark />
      </div>
    </div>
  );
}

/* ----------------------------- Characters ----------------------------- */

/** Shared tangerine body + face. */
function Tangerine() {
  return (
    <>
      <ellipse cx="50" cy="58" rx="26" ry="24" fill="#F5872E" />
      <ellipse cx="50" cy="58" rx="26" ry="24" fill="url(#pShine)" />
      <circle cx="41" cy="57" r="2.5" fill="#3A2418" />
      <circle cx="59" cy="57" r="2.5" fill="#3A2418" />
      <path d="M43 65c2 2 12 2 14 0" stroke="#3A2418" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <ellipse cx="37" cy="63" rx="3" ry="2" fill="#FBB27A" opacity="0.85" />
      <ellipse cx="63" cy="63" rx="3" ry="2" fill="#FBB27A" opacity="0.85" />
    </>
  );
}

const CHAR_META = {
  AVATAR_01: { label: "안경 쓴 귤 캐릭터", bg: "#ffffff" },
  AVATAR_02: { label: "초록 학사모 귤 캐릭터", bg: "#EEF4CF" },
  AVATAR_03: { label: "학사모와 책을 든 귤 캐릭터", bg: "#E7EBF4" },
} as const;

export type AvatarKey = keyof typeof CHAR_META;
export const AVATAR_KEYS = Object.keys(CHAR_META) as AvatarKey[];
export const avatarLabel = (k: AvatarKey) => CHAR_META[k].label;
export const avatarBg = (k: AvatarKey) => CHAR_META[k].bg;

function CharacterArt({ variant }: { variant: AvatarKey }) {
  return (
    <svg viewBox="0 0 100 100" width="62%" height="62%" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pShine" cx="0.35" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#FFB56B" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#FFB56B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {variant === "AVATAR_01" && (
        <>
          {/* raised arms */}
          <path d="M27 54c-6-4-10-10-10-16" stroke="#F5872E" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M73 54c6-4 10-10 10-16" stroke="#F5872E" strokeWidth="6" strokeLinecap="round" fill="none" />
          {/* leaf */}
          <path d="M52 20c4-5 10-6 14-5 .5 3-.6 8.4-5.2 10.5-3.7 1.7-7 .3-7.9-.5-.8-1.5-1.2-3.2.9-5z" fill="#5FB65B" />
          <Tangerine />
          {/* blue glasses */}
          <circle cx="41" cy="57" r="6.5" fill="none" stroke="#2F6BE0" strokeWidth="2.4" />
          <circle cx="59" cy="57" r="6.5" fill="none" stroke="#2F6BE0" strokeWidth="2.4" />
          <path d="M47.5 56h5" stroke="#2F6BE0" strokeWidth="2.4" />
        </>
      )}

      {variant === "AVATAR_02" && (
        <>
          <Tangerine />
          {/* green graduation cap */}
          <path d="M26 34l24-9 24 9-24 9-24-9z" fill="#4E9A54" />
          <path d="M35 39v8c0 3 30 3 30 0v-8" fill="none" stroke="#3F8144" strokeWidth="2.4" />
          <path d="M74 34v9" stroke="#3F8144" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="74" cy="45" r="2.2" fill="#E7C24B" />
        </>
      )}

      {variant === "AVATAR_03" && (
        <>
          {/* arms holding items */}
          <path d="M28 58c-6 1-10 4-11 9" stroke="#F5872E" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M72 58c6 1 10 4 11 9" stroke="#F5872E" strokeWidth="6" strokeLinecap="round" fill="none" />
          <rect x="10" y="64" width="12" height="12" rx="2" fill="#3F6BE0" />
          <rect x="78" y="64" width="13" height="10" rx="1.5" fill="#E9873A" stroke="#C56A22" strokeWidth="1.4" />
          <Tangerine />
          {/* dark graduation cap */}
          <path d="M26 33l24-9 24 9-24 9-24-9z" fill="#2C333B" />
          <path d="M35 38v8c0 3 30 3 30 0v-8" fill="none" stroke="#1F2731" strokeWidth="2.4" />
          <path d="M74 33v9" stroke="#1F2731" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="74" cy="45" r="2.2" fill="#E7C24B" />
        </>
      )}
    </svg>
  );
}

/** One selectable character avatar (circle bg + art + optional orange ring). */
export function CharacterAvatar({ variant, selected }: { variant: AvatarKey; selected: boolean }) {
  return (
    <span
      className={`setupp__char ${selected ? "is-selected" : ""}`}
      style={{ background: avatarBg(variant) }}
      aria-hidden="true"
    >
      <CharacterArt variant={variant} />
    </span>
  );
}

/* ------------------------------ Camera icon ------------------------------ */

export function CameraIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.7l.9-1.5A1 1 0 0 1 8.9 5h6.2a1 1 0 0 1 .86.5L16.8 7h1.7A1.5 1.5 0 0 1 20 8.5v8A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-8z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.3" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
