import { useEffect, useRef } from "react";
import { useTranslation } from "../../i18n";
import { useAnchoredPosition } from "../../hooks/useAnchoredPosition";
import type { ManagementPeriod } from "../../lib/types";
import { PERIODS } from "./format";

/** Compact period selector anchored below its trigger. */
export function PeriodDropdown({
  period,
  open,
  setOpen,
  onSelect,
}: {
  period: ManagementPeriod;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (p: ManagementPeriod) => void;
}) {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Right-aligned under the trigger.
  const pos = useAnchoredPosition(triggerRef, open, (r) => ({ top: r.bottom + 6, left: r.right }));

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ __lmp: true }, "");
    let pushed = true;
    const onPop = () => {
      pushed = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      if (pushed) window.history.back(); // drop the dummy entry on in-place close
    };
  }, [open, setOpen]);

  const label = t(PERIODS.find((p) => p.id === period)!.label);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lmgmt__period-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("learningManagement.periodAria")}
        onClick={() => setOpen(!open)}
      >
        <span className="lmgmt__period-label">{label}</span>
        {/* ic_16_arrow as `Group 1410118472` exports it: 20x20, #5A636A, 1.5px,
            square caps — already pointing down, so no base rotation. */}
        <svg
          className={`lmgmt__period-chev${open ? " lmgmt__period-chev--up" : ""}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15.9375 6.5625L10.3125 12.1875L4.6875 6.5625"
            stroke="#5A636A"
            strokeWidth="1.5"
            strokeMiterlimit="10"
            strokeLinecap="square"
          />
        </svg>
      </button>
      {open && (
        <div className="lsw__overlay" onClick={() => setOpen(false)}>
          <div
            className="lmgmt__period-menu"
            role="menu"
            aria-label={t("learningManagement.period")}
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {PERIODS.map((p, i) => (
              <div key={p.id} className="lsw__row">
                {i > 0 && <div className="lmgmt__period-divider" aria-hidden="true" />}
                <button
                  type="button"
                  role="menuitem"
                  aria-current={p.id === period ? "true" : undefined}
                  className={`lmgmt__period-option${p.id === period ? " lmgmt__period-option--active" : ""}`}
                  onClick={() => onSelect(p.id)}
                >
                  {t(p.label)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
