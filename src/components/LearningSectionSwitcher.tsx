import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/** The two learning sections reachable from the title dropdown. */
export type LearningSection = "streak" | "management";

const ROUTES: Record<LearningSection, string> = {
  streak: "/streak",
  management: "/learning-management",
};
// App has no i18n framework yet — chrome strings are Korean literals (as
// elsewhere). Kept in one place so both pages stay in sync.
const LABELS: Record<LearningSection, string> = {
  streak: "연속 학습",
  management: "학습 관리",
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
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  // Anchor the menu directly under the title: centered on the trigger, dropped
  // just below its bottom edge. Re-measured on resize/scroll while open.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<LearningSection, HTMLButtonElement | null>>({
    streak: null,
    management: null,
  });
  const navigatingRef = useRef(false);
  const pushedRef = useRef(false);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

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
        aria-label="학습 섹션 변경"
        onClick={() => setOpen((v) => !v)}
      >
        {LABELS[current]}
        <svg className="lsw__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 9l6 6 6-6" stroke="#AEB7BE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="lsw__overlay" onClick={() => setOpen(false)}>
          <div
            ref={menuRef}
            className="lsw__menu"
            role="menu"
            aria-label="학습 섹션"
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
                  {LABELS[section]}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
