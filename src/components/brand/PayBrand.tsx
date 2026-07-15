/**
 * Easy-payment provider marks for the Payment Method Management screen.
 *
 * No official raster/vector brand assets ship in this repo (see AuthBrand.tsx),
 * so the Toss Pay and Naver Pay logos are implemented as brand-accurate inline
 * SVG using each provider's official colour and wordmark. They scale crisply and
 * carry an accessible label; the glyphs themselves are `aria-hidden`.
 */

/** Toss Pay — official Toss blue (#0064FF) wordmark. */
export function TossPayLogo({ height = 22 }: { height?: number }) {
  return (
    <span className="paybrand" role="img" aria-label="토스페이" style={{ height }}>
      <svg viewBox="0 0 132 32" height={height} aria-hidden="true" focusable="false">
        <rect width="132" height="32" rx="6" fill="#0064FF" />
        <text
          x="66"
          y="21"
          textAnchor="middle"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="15"
          fontWeight="800"
          letterSpacing="-0.3"
          fill="#ffffff"
        >
          toss pay
        </text>
      </svg>
    </span>
  );
}

/** Naver Pay — official Naver green (#03C75A) "N Pay" mark. */
export function NaverPayLogo({ height = 22 }: { height?: number }) {
  return (
    <span className="paybrand" role="img" aria-label="네이버페이" style={{ height }}>
      <svg viewBox="0 0 96 32" height={height} aria-hidden="true" focusable="false">
        <rect width="32" height="32" rx="7" fill="#03C75A" />
        {/* stylised Naver "N" */}
        <path d="M10 9h4.4l3.4 5.1V9H22v14h-4.4l-3.4-5.1V23H10V9z" fill="#ffffff" />
        <text
          x="60"
          y="22"
          textAnchor="middle"
          fontFamily="-apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif"
          fontSize="15"
          fontWeight="800"
          letterSpacing="-0.2"
          fill="#03C75A"
        >
          Pay
        </text>
      </svg>
    </span>
  );
}
