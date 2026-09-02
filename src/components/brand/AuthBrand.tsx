import logoMark from "../../assets/brand/hangyul-mark.svg";
import { useTranslation } from "../../i18n";
import logoWordmark from "../../assets/brand/hangyul-wordmark.svg";
import citrus1 from "../../assets/brand/citrus-1.svg";
import citrus2 from "../../assets/brand/citrus-2.svg";
import citrus3 from "../../assets/brand/citrus-3.svg";
import citrus4 from "../../assets/brand/citrus-4.svg";
import authGlow from "../../assets/brand/auth-glow.svg";
/**
 * Brand + provider marks for the single-screen auth landing.
 *
 * The Hangyul lockup and the decorative citrus outlines are the assets exported
 * from Figma (see the per-component notes); only the third-party provider marks
 * are inline SVG, since those come from each vendor's own brand guidelines.
 * Decorative pieces are non-interactive (`aria-hidden`, and the parent layer
 * sets `pointer-events: none`).
 */

/* ----------------------------- Brand logo ----------------------------- */

/**
 * Brand lockup, exported from Figma `_레이어_1` (AME-003, node 1:3453).
 * The frame is 210x44; the mark sits at (0,0) 31.57x37.37 and the wordmark at
 * (41, 6.38) 169x37.62 — do not redraw these by hand.
 */
export function HangyulLogo() {
  const { t } = useTranslation();
  return (
    <div className="auth__logo" role="img" aria-label={t("misc.brandLogoA11y")}>
      <img className="auth__logo-mark" src={logoMark} alt="" />
      <img className="auth__logo-word" src={logoWordmark} alt="" />
    </div>
  );
}

export function GoogleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#ffba00"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

/** Apple logo (single color; white on the charcoal button). */
export function AppleIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M16.365 1.43c0 1.14-.49 2.27-1.18 3.08-.74.9-1.99 1.57-2.98 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.2-2.98.81-.94 2.15-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.51 3.12-.95 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8C3.98 18.38 2.94 15.57 2.94 12.92c0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.67.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45z" />
    </svg>
  );
}

/** Facebook "f" (white glyph; the button supplies the blue circle). */
export function FacebookIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" aria-hidden="true" focusable="false">
      <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2c-2.72 0-4.58 1.66-4.58 4.7v2.6H6.61v3.56h3.07V22h3.68v-9.14h3.06l.46-3.56h-3.52V7.05c0-1.03.28-1.73 1.76-1.73z" />
    </svg>
  );
}

/** KakaoTalk speech-bubble symbol (black glyph; the button supplies yellow). */
export function KakaoIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#191600" aria-hidden="true" focusable="false">
      <path d="M12 3.5C6.75 3.5 2.5 6.85 2.5 10.98c0 2.66 1.78 4.99 4.46 6.3-.18.64-.68 2.45-.78 2.83-.12.47.17.46.36.34.15-.1 2.4-1.63 3.37-2.29.55.08 1.12.12 1.69.12 5.25 0 9.5-3.35 9.5-7.3S17.25 3.5 12 3.5z" />
    </svg>
  );
}

/** LINE mark: white rounded speech bubble containing "LINE" (button = green). */
export function LineIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path
        fill="#fff"
        d="M16 5C9.92 5 5 8.94 5 13.8c0 4.36 3.9 8.01 9.17 8.7.36.08.84.24.96.55.11.28.07.72.04 1l-.16.94c-.05.28-.22 1.1.96.6 1.18-.5 6.36-3.75 8.68-6.42C26.2 17.4 27 15.7 27 13.8 27 8.94 22.08 5 16 5z"
      />
      <text
        x="16"
        y="15.6"
        textAnchor="middle"
        fontFamily="Nunito, system-ui, sans-serif"
        fontWeight="800"
        fontSize="6.4"
        fill="#06C755"
        letterSpacing="0.2"
      >
        LINE
      </text>
    </svg>
  );
}

/* ------------------------ Decorative background ----------------------- */

const CITRUS = [citrus1, citrus2, citrus3, citrus4];

/**
 * Decorative citrus sketch, exported from Figma AME-002 (decor group 37:6819).
 * The four outlines are DISTINCT drawings — Group 1410118266 / 267 / 268 / 279 —
 * and each is placed at its own size and rotation, so `variant` is not
 * interchangeable. Sizes default to each export's natural dimensions, which are
 * exactly what the frame draws them at.
 */
const CITRUS_NATURAL = {
  1: { w: 52.4532, h: 51.583 },
  2: { w: 67.9086, h: 66.8522 },
  3: { w: 80.0909, h: 78.8612 },
  4: { w: 85.0876, h: 83.8682 },
} as const;

export function CitrusOutline({
  className,
  size,
  height,
  variant = 1,
}: {
  className: string;
  /** Overrides the export's natural width; AME-002 uses the natural size. */
  size?: number;
  height?: number;
  variant?: 1 | 2 | 3 | 4;
}) {
  const nat = CITRUS_NATURAL[variant];
  return (
    <img
      className={className}
      src={CITRUS[variant - 1]}
      alt=""
      aria-hidden="true"
      style={{ width: size ?? nat.w, height: height ?? (size ? size : nat.h) }}
    />
  );
}

/**
 * AME-002's background layer, placed against the FOREGROUND ANCHORS.
 *
 * The four sketches are different drawings at different natural sizes, and the
 * brief's size hierarchy falls out of the exports themselves — no shared scale
 * value, and none of them is resized:
 *
 *   social (variant 4)  85.088  largest
 *   login  (variant 3)  80.091  medium-large
 *   upper  (variant 2)  67.909  medium
 *   google (variant 1)  52.453  clearly the smallest
 *
 * Classes are named for the UI element each one is anchored to rather than
 * numbered, because the variant a slot renders is NOT its slot number: the
 * medium-large sketch belongs beside Log in and the smallest behind the Google
 * button, so variants 1 and 3 are swapped relative to the old --1/--3 naming.
 * Top-to-bottom the painted centres run 150 -> 305 -> 434 -> 576.
 */
export function AuthDecor() {
  return (
    <div className="auth__decor" aria-hidden="true">
      {/* Ellipse 862 (37:6838) — 264.708 circle, gradient and both opacities
          baked into the export. Not one of the four tangerines. */}
      <img className="auth__glow" src={authGlow} alt="" />
      <CitrusOutline className="auth__citrus auth__citrus--upper" variant={2} />
      <CitrusOutline className="auth__citrus auth__citrus--login" variant={3} />
      <CitrusOutline className="auth__citrus auth__citrus--google" variant={1} />
      <CitrusOutline className="auth__citrus auth__citrus--social" variant={4} />
    </div>
  );
}
