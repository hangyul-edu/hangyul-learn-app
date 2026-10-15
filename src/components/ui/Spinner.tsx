/** Sizes an inline spinner comes in (px), and its ring widths. */
export type SpinnerSize = 14 | 15 | 16 | 18 | 20 | 22 | 24 | 26;
export type SpinnerStroke = 2 | 2.5;

/**
 * The loading ring. `large` is the full-screen state's; `size` (with an
 * optional thinner `stroke`) fits it inside a button or a row. Sized by
 * classes, so a busy button keeps the exact footprint of its label.
 */
export function Spinner({
  large,
  size,
  stroke,
  label,
}: {
  large?: boolean;
  size?: SpinnerSize;
  stroke?: SpinnerStroke;
  /** Accessible name, when the spinner stands in for a button label. */
  label?: string;
}) {
  const cls = [
    "spinner",
    large && "spinner--lg",
    size && `spinner--s${size}`,
    stroke && `spinner--w${String(stroke).replace(".", "")}`,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} aria-label={label} />;
}
