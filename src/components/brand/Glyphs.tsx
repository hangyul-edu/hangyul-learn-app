/**
 * The line glyphs every header repeats: the back chevron and the close ✕,
 * drawn on a 24-unit grid with round caps. Decorative — the button that holds
 * one carries the accessible name.
 */

export function BackChevronIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon({
  size = 24,
  color = "currentColor",
  weight = 2.2,
}: {
  size?: number;
  color?: string;
  weight?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={weight} strokeLinecap="round" />
    </svg>
  );
}

/** The rounded check mark of checkboxes, selected options and verdicts. */
export function CheckIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
