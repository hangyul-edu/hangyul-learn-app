import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAnchoredPosition } from "../hooks/useAnchoredPosition";
import { useTranslation, type TranslationKey } from "../i18n";

/** The two learning sections reachable from the title dropdown. */
export type LearningSection = "streak" | "management";

const ROUTES: Record<LearningSection, string> = {
  streak: "/streak",
  management: "/learning-management",
};
/** Section labels, kept in one place so both pages stay in sync. */
const LABEL_KEYS: Record<LearningSection, TranslationKey> = {
  streak: "misc.sectionStreak",
  management: "misc.sectionManagement",
};
const ORDER: LearningSection[] = ["streak", "management"];

/**
 * Page-title dropdown that switches between the Continuous Learning (연속 학습)
 * and Learning Management (학습 관리) pages. Reused by both pages — pass the
 * section the current page represents; that option renders selected (orange)
 * and, when tapped, just closes without navigating.
 *
 * Dismisses on backdrop tap, Escape, hardware/browser back, and on navigation.
 * Selecting the other section navigates exactly once (guarded against double
 * taps). Selecting the current section never re-navigates, so page state
 * (scroll, filters, fetched data) is preserved.
 */
export function LearningSectionSwitcher({ current }: { current: LearningSection }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  // Anchor the menu directly under the title: centered on the trigger, dropped
  // just below its bottom edge. Re-measured on resize/scroll while open.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pos = useAnchoredPosition(triggerRef, open, (r) => ({ top: r.bottom + 6, left: r.left + r.width / 2 }));
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<LearningSection, HTMLButtonElement | null>>({
    streak: null,
    management: null,
  });
  const navigatingRef = useRef(false);
  const pushedRef = useRef(false);


  useEffect(() => {
    if (!open) return;
    // Push a history entry so hardware/browser back closes the menu instead of
    // leaving the page. Removed again on in-place close; left in place when we
    // navigate away (it shares the current URL, so it's invisible).
    window.history.pushState({ __lsw: true }, "");
    pushedRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the menu, onto the selected option.
    optionRefs.current[current]?.focus();

    function onPop() {
      pushedRef.current = false; // our entry was already popped by the back
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = ORDER.findIndex((s) => optionRefs.current[s] === document.activeElement);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const next = ORDER[(idx + delta + ORDER.length) % ORDER.length];
        optionRefs.current[next]?.focus();
      }
    }
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Restore focus to the trigger unless we're navigating away.
      if (!navigatingRef.current) triggerRef.current?.focus();
      // Drop the dummy history entry on in-place close (back already popped it
      // when pushedRef is false; skip while navigating so we don't fight the
      // pending route change).
      if (pushedRef.current && !navigatingRef.current) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open, current]);

  function select(section: LearningSection) {
    setOpen(false);
    if (section === current) return; // stay put — no navigation, no reload
    if (navigatingRef.current) return; // ignore rapid double taps
    navigatingRef.current = true;
    nav(ROUTES[section]);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lsw__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("misc.sectionChangeA11y")}
        onClick={() => setOpen((v) => !v)}
      >
        {t(LABEL_KEYS[current])}
        {/* ic_16_arrow exactly as HMA-001/002 export it (20x20, #ADB4BA, 2px,
            square caps). The frame instance is rotated 180deg — done in CSS. */}
        <svg className="lsw__chev" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M4.6874 12.1875L10.3124 6.56249L15.9374 12.1875"
            stroke="#ADB4BA"
            strokeWidth="2"
            strokeMiterlimit="10"
            strokeLinecap="square"
          />
        </svg>
      </button>

      {open && (
        <div className="lsw__overlay" onClick={() => setOpen(false)}>
          <div
            ref={menuRef}
            className="lsw__menu"
            role="menu"
            aria-label={t("misc.sectionAria")}
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {ORDER.map((section, i) => (
              <div key={section} className="lsw__row">
                {i > 0 && <div className="lsw__divider" aria-hidden="true" />}
                <button
                  ref={(el) => {
                    optionRefs.current[section] = el;
                  }}
                  type="button"
                  role="menuitem"
                  aria-current={section === current ? "page" : undefined}
                  className={`lsw__option${section === current ? " lsw__option--active" : ""}`}
                  onClick={() => select(section)}
                >
                  {t(LABEL_KEYS[section])}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * The Streak / Learning-management header: back to Home, and the switcher
 * between the two. The back glyph is ic_B_topNav variant=back exactly as
 * HMA-001/002 export it.
 */
export function LearningSectionHeader({ current, className }: { current: LearningSection; className?: string }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  return (
    <header className={className ? `strk__header ${className}` : "strk__header"}>
      <button className="strk__back" onClick={() => nav("/home")} aria-label={t("common.back")}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16 21L7 12L16 3"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeMiterlimit="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <LearningSectionSwitcher current={current} />
    </header>
  );
}
