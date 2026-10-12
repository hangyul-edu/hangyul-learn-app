import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { PHONE_COUNTRIES, countryName, phoneCountry, type PhoneCountry } from "../../lib/phone";

interface Entry extends PhoneCountry {
  name: string;
  /** Lower-cased text a search query is matched against. */
  haystack: string;
}

/**
 * Compact country selector: a small flag + chevron button that opens an anchored
 * dropdown listing every country and territory with its calling code (not a
 * bottom sheet), all in the app language's alphabetical order (가나다 in
 * Korean, A–Z in English); a search field filters by name (in the app
 * language or English), ISO code or calling code. Reports the selected ISO
 * code so the caller can resolve the dial code for phone parsing. The chevron
 * points down when closed and up when open. The dropdown closes on outside
 * click or Escape.
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
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const current = phoneCountry(value);

  const entries = useMemo<Entry[]>(() => {
    return PHONE_COUNTRIES.map((c) => {
      const name = countryName(c.code, language);
      return { ...c, name, haystack: `${name} ${countryName(c.code, "en")} ${c.code} ${c.dial}`.toLowerCase() };
    }).sort((a, b) => a.name.localeCompare(b.name, language));
  }, [language]);

  const currentName = entries.find((e) => e.code === current.code)?.name ?? current.code;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    // "82", "+82" and "0082" all mean the calling code.
    const dial = q.replace(/^(\+|00)/, "");
    return entries.filter((e) =>
      /^\d+$/.test(dial) ? e.dial.slice(1).startsWith(dial) : e.haystack.includes(q),
    );
  }, [entries, query]);

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

  // A fresh search each time it opens, scrolled to the current country — with
  // ~245 rows it may be far down the list.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const selected = rootRef.current?.querySelector<HTMLElement>(".country-select__item.is-selected");
    selected?.scrollIntoView?.({ block: "nearest" });
  }, [open]);

  return (
    <div className="country-select" ref={rootRef}>
      <button
        type="button"
        className={`country-select__trigger ${className}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("ui.countrySelectA11y", { name: currentName })}
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
        <div className="country-select__panel">
          <input
            className="country-select__search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ui.countrySearch")}
            aria-label={t("ui.countrySearch")}
            autoComplete="off"
            enterKeyHint="search"
          />
          <ul className="country-select__list" role="listbox" aria-label={t("ui.countrySelect")}>
            {visible.map((n) => (
              <li key={n.code} role="option" aria-selected={n.code === current.code}>
                <button
                  type="button"
                  className={`country-select__item ${n.code === current.code ? "is-selected" : ""}`}
                  onClick={() => {
                    onChange(n.code);
                    setOpen(false);
                  }}
                >
                  <span className="country-select__flag" aria-hidden="true">
                    {n.flag}
                  </span>
                  <span className="country-select__label">{n.name}</span>
                  <span className="country-select__dial">{n.dial}</span>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="country-select__empty">{t("ui.countryNoMatch")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
