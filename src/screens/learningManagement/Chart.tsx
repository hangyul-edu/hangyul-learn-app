import { useTranslation } from "../../i18n";
import { localeFor } from "../../lib/format";
import type { ManagementStats } from "../../lib/types";
import { bucketLabel, fmtShort } from "./format";

/**
 * Bar chart of study duration per bucket. Bars are selectable: the highlighted
 * (orange) bar shows its duration above it — the current bucket is selected by
 * default, and tapping any bar moves the highlight (and drives the totals below
 * the chart). Selection is owned by the parent so the totals can read it.
 */
export function Chart({
  data,
  selectedKey,
  onSelect,
}: {
  data: ManagementStats;
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
}) {
  const { t, language } = useTranslation();
  const locale = localeFor(language);
  const max = Math.max(1, ...data.buckets.map((b) => b.study_seconds));
  return (
    <div className="lmgmt__chart" role="group" aria-label={t("learningManagement.periodHeading")}>
      {data.buckets.map((b, i) => {
        const selected = b.key === selectedKey;
        const label = bucketLabel(b, data.period, i, locale, t);
        const pct =
          b.study_seconds > 0 ? Math.max(8, (b.study_seconds / max) * 100) : selected ? 3 : 0;
        return (
          <div key={b.key} className="lmgmt__bar-col">
            <button
              type="button"
              className="lmgmt__bar-track"
              aria-pressed={selected}
              aria-label={`${label} ${fmtShort(b.study_seconds)}`}
              onClick={() => onSelect(b.key)}
            >
              <div
                className={`lmgmt__bar${b.is_current ? " lmgmt__bar--current" : ""}${selected ? " lmgmt__bar--selected" : ""}`}
                style={{ height: `${pct}%` }}
              >
                {selected && <span className="lmgmt__bar-value">{fmtShort(b.study_seconds)}</span>}
              </div>
            </button>
            <span className="lmgmt__bar-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
