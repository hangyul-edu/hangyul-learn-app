import type { CSSProperties } from "react";
import type { TranslationKey } from "../../i18n";
import profilePlaceholderArt from "../../assets/brand/profile-placeholder.svg";
import avatar01Art from "../../assets/brand/avatar-01.svg";
import avatar02Art from "../../assets/brand/avatar-02.svg";
import avatar03Art from "../../assets/brand/avatar-03.svg";
/**
 * Profile-registration visuals. The default placeholder and the three mascot
 * characters are the artworks exported from Figma AME-006 "프로필 변경"
 * (290:13195) — do not redraw them; re-export from that frame if the design
 * changes.
 */

/* -------------------- Large preview placeholder -------------------- */

/**
 * Default circular profile image — exported whole from Figma AME-006
 * (Group 1410118219, node 290:13284). The grey ring, inner disc and the
 * smiling tangerine mark are one artwork there, so the two nested CSS circles
 * this used to stack are gone with it.
 */
export function ProfilePlaceholder() {
  return <img className="setupp__placeholder" src={profilePlaceholderArt} alt="" aria-hidden="true" />;
}

/* ----------------------------- Characters ----------------------------- */

/* Tints and artwork sizes read off AME-006 (290:13195). Each character's art
   is exported at its natural size and Figma draws it 1:1 inside the 80px
   button — 69 x 64.262 / 62.844 x 54.245 (tilted 3.77deg) / 57.542 x 40.242 —
   so the picker renders them at those exact dimensions rather than scaling one
   shared percentage, which over-sized the 2nd and 3rd characters. */
const CHAR_META = {
  AVATAR_01: { bg: "#FCEFE3", w: 69, h: 64.2618, rotate: 0, dx: -0.06, dy: -1.75 },
  AVATAR_02: { bg: "#EAEFD2", w: 62.8439, h: 54.5923, rotate: 3.77, dx: -1.31, dy: 2.63 },
  AVATAR_03: { bg: "#E7EAF2", w: 57.5421, h: 40.2419, rotate: 0, dx: -0.19, dy: 0 },
} as const;

/** The artwork URL for a character (for callers that place it themselves). */
export function characterArtSrc(variant: AvatarKey) {
  return CHAR_ART[variant];
}

/**
 * Centres a character on its INK rather than on its bounding box.
 *
 * The three exports are not drawn centred inside their own viewBoxes — measured
 * at 8x supersample, and after AVATAR_02's 3.77deg tilt, the visible artwork
 * sits (0.06, 1.75) / (1.31, -2.63) / (0.19, 0) away from each box's centre. So
 * `place-items: center` alone lands the box centre on the circle's centre and
 * leaves the character itself visibly low / high-and-right. `dx`/`dy` above are
 * the measured offsets negated; they are quoted at the 80px picker size and
 * scale with the frame.
 */
export function characterArtStyle(variant: AvatarKey, frame = 80): CSSProperties {
  const m = CHAR_META[variant];
  const k = frame / 80;
  const t = [`translate(${(m.dx * k).toFixed(3)}px, ${(m.dy * k).toFixed(3)}px)`];
  if (m.rotate) t.push(`rotate(${m.rotate}deg)`);
  return {
    width: m.w * k,
    height: m.h * k,
    display: "block",
    transform: t.join(" "),
  };
}

export type AvatarKey = keyof typeof CHAR_META;
export const AVATAR_KEYS = Object.keys(CHAR_META) as AvatarKey[];
/** The accessible name lives in the catalogs; callers pass this to `t()`. */
export const avatarLabelKey = (k: AvatarKey): TranslationKey => `avatars.${k}`;
export const avatarBg = (k: AvatarKey) => CHAR_META[k].bg;

const CHAR_ART: Record<AvatarKey, string> = {
  AVATAR_01: avatar01Art,
  AVATAR_02: avatar02Art,
  AVATAR_03: avatar03Art,
};

/**
 * One of the three Hangyul mascot characters, exported from Figma
 * AME-006 "\uD504\uB85C\uD544 \uBCC0\uACBD" (290:13195): groups 1410118298 / 1410118292 /
 * 1410118290. Each artwork has its own aspect (they strike different poses and
 * hold different props), so it is contained inside the caller's square box
 * rather than stretched to it.
 */
export function CharacterArt({ variant, fill = "62%" }: { variant: AvatarKey; fill?: string }) {
  return (
    <img
      src={CHAR_ART[variant]}
      alt=""
      aria-hidden="true"
      style={{ width: fill, height: fill, objectFit: "contain", display: "block" }}
    />
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
      {/* Natural-size art, centred by the button's own `place-items: center`
          (AME-006 centres all three; only the 2nd is nudged 4.5 low there,
          which reads as a slip). */}
      <img src={CHAR_ART[variant]} alt="" aria-hidden="true" style={characterArtStyle(variant, 80)} />
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
