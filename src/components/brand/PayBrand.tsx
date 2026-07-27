/**
 * Easy-payment provider marks for the Payment Method Management screen.
 *
 * NOTE: no official Toss Pay / Naver Pay brand-kit asset files ship in this repo
 * (and they can't be fetched at build time here). These are brand-approximate
 * inline-SVG lockups in each provider's official colour — transparent
 * background, no surrounding box, correct proportions, sized by a `height` prop.
 * To use the official artwork instead, drop the provider's brand SVG into
 * `src/assets/` and render it from here (e.g. an `<img>`); every call site only
 * passes `height`, so the swap stays local to this file.
 *
 * The `.paybrand` wrapper (see global.css) centres the mark and scales it with
 * `object-fit: contain` semantics, so the logo never stretches, crops, or
 * pixelates. Toss Pay uses a wider horizontal lockup than Naver Pay by design;
 * the two are normalised by perceived size via provider-specific heights set at
 * the call site (see EASY_PAY in PaymentMethods.tsx), not by a shared width.
 */

type LogoProps = { height?: number };

/** Toss Pay — official Toss blue (#0064FF) horizontal wordmark, no box. */
export function TossPayLogo({ height = 26 }: LogoProps) {
  return (
    <span className="paybrand" role="img" aria-label="토스페이" style={{ height }}>
      {/* Wide 4.1:1 lockup — renders visibly wider than Naver Pay. */}
      <svg viewBox="0 0 132 32" aria-hidden="true" focusable="false">
        <text
          x="0"
          y="25"
          textLength="128"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="27"
          fontWeight="800"
          letterSpacing="-1"
          fill="#0064FF"
        >
          toss pay
        </text>
      </svg>
    </span>
  );
}

/** Naver Pay — official Naver green (#03C75A) "N Pay" lockup, no outer box. */
export function NaverPayLogo({ height = 32 }: LogoProps) {
  return (
    <span className="paybrand" role="img" aria-label="네이버페이" style={{ height }}>
      {/* Green N icon + "Pay" wordmark kept together as one lockup. */}
      <svg viewBox="0 0 84 32" aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="8" fill="#03C75A" />
        <path d="M10 9h4.4l3.4 5.1V9H22v14h-4.4l-3.4-5.1V23H10V9z" fill="#ffffff" />
        <text
          x="40"
          y="24"
          textLength="44"
          lengthAdjust="spacingAndGlyphs"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="22"
          fontWeight="800"
          letterSpacing="-0.5"
          fill="#03C75A"
        >
          Pay
        </text>
      </svg>
    </span>
  );
}
