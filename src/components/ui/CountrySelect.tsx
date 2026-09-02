import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { NATIONALITIES } from "../../lib/format";

/**
 * Compact country selector: a small flag + chevron button that opens an anchored
 * dropdown listing the supported countries (not a bottom sheet). Reports the
 * selected ISO code so the caller can resolve the dial code for phone parsing.
 * The chevron points down when closed and up when open. The dropdown closes on
 * outside click or Escape.
 */
export function CountrySelect({
  value,
  onChange,
  className = "signup__country",
}: {
  value: string;
  onChange: (code: string) => void;
  /** Per-screen trigger class (geometry only); defaults to the sign-up style.
   * The shared `country-select__trigger` class is always applied alongside it
   * and owns the resting/active border behaviour. */
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = NATIONALITIES.find((n) => n.code === value) ?? NATIONALITIES[0];

  // Dismiss on outside click / Escape while open (the dropdown has no backdrop).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="country-select" ref={rootRef}>
      <button
        type="button"
        className={`country-select__trigger ${className}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("ui.countrySelectA11y", { name: t(current.labelKey) })}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="signup__country-flag" aria-hidden="true">
          {current.flag}
        </span>
        <span className="signup__country-chev" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            {/* Down (closed) → up (open), reflecting the dropdown state. */}
            <path
              d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"}
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <ul className="country-select__list" role="listbox" aria-label={t("ui.countrySelect")}>
          {NATIONALITIES.map((n) => (
            <li key={n.code} role="option" aria-selected={n.code === value}>
              <button
                type="button"
                className={`country-select__item ${n.code === value ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(n.code);
                  setOpen(false);
                }}
              >
                <span className="country-select__flag" aria-hidden="true">
                  {n.flag}
                </span>
                <span className="country-select__label">{t(n.labelKey)}</span>
                <span className="country-select__dial">{n.dial}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
