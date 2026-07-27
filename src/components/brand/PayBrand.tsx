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

/**
 * Toss Pay — the icon (Toss blue #0064FF) next to the wordmark, matching the
 * official horizontal lockup: `toss` bold + `pay` regular, both black.
 */
export function TossPayLogo({ height = 30 }: LogoProps) {
  return (
    <span className="paybrand" role="img" aria-label="토스페이" style={{ height }}>
      {/* Icon + wordmark → wide lockup, renders visibly wider than Naver Pay. */}
      <svg viewBox="0 0 150 32" aria-hidden="true" focusable="false">
        {/* Toss-blue icon mark. */}
        <rect width="32" height="32" rx="9" fill="#0064FF" />
        <rect
          x="8.5"
          y="8.5"
          width="15"
          height="15"
          rx="4.5"
          fill="#ffffff"
          transform="rotate(45 16 16)"
        />
        {/* Wordmark: `toss` bold + `pay` regular, both black. */}
        <text
          x="42"
          y="23.5"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="23"
          letterSpacing="-0.6"
          fill="#111111"
        >
          <tspan fontWeight="800">toss</tspan>
          <tspan dx="7" fontWeight="400">pay</tspan>
        </text>
      </svg>
    </span>
  );
}

/** Naver Pay — circular green (#03C75A) N icon + `pay` wordmark, no outer box. */
export function NaverPayLogo({ height = 30 }: LogoProps) {
  return (
    <span className="paybrand" role="img" aria-label="네이버페이" style={{ height }}>
      {/* Circular green N icon + "Pay" wordmark kept together as one lockup. */}
      <svg viewBox="0 0 84 32" aria-hidden="true" focusable="false">
        <circle cx="16" cy="16" r="16" fill="#03C75A" />
        <path d="M10 9h4.4l3.4 5.1V9H22v14h-4.4l-3.4-5.1V23H10V9z" fill="#ffffff" />
        {/* `pay` — same font/size/weight/colour as the Toss Pay wordmark. */}
        <text
          x="42"
          y="23.5"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="23"
          fontWeight="400"
          letterSpacing="-0.6"
          fill="#111111"
        >
          pay
        </text>
      </svg>
    </span>
  );
}
