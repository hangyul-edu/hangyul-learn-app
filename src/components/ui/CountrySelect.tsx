import { useState } from "react";
import { Sheet } from "./Modal";
import { NATIONALITIES } from "../../lib/format";

/**
 * Compact country selector: a small flag + chevron button that opens a sheet
 * listing the supported countries. Reports the selected ISO code so the caller
 * can resolve the dial code for phone parsing.
 */
export function CountrySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = NATIONALITIES.find((n) => n.code === value) ?? NATIONALITIES[0];

  return (
    <>
      <button
        type="button"
        className="signup__country"
        onClick={() => setOpen(true)}
        aria-label={`국가 선택, 현재 ${current.label}`}
        aria-haspopup="dialog"
      >
        <span className="signup__country-flag" aria-hidden="true">
          {current.flag}
        </span>
        <span className="signup__country-chev" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="국가 선택">
        <div className="stack" style={{ gap: 4 }}>
          {NATIONALITIES.map((n) => (
            <button
              key={n.code}
              type="button"
              className="listrow"
              aria-current={n.code === value}
              onClick={() => {
                onChange(n.code);
                setOpen(false);
              }}
            >
              <span style={{ fontSize: 22 }} aria-hidden="true">
                {n.flag}
              </span>
              <div className="listrow__main">
                <div className="listrow__title">{n.label}</div>
              </div>
              <span className="dim" style={{ fontSize: 14 }}>
                {n.dial}
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
