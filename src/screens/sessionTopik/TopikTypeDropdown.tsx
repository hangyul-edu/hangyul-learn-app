import { useRef } from "react";
import { useTranslation, type TranslationKey } from "../../i18n";
import { useDismiss } from "../../hooks/useDismiss";
import { TOPIK_TYPE_LABEL_EN, TOPIK_TYPE_LABEL_KO } from "../../lib/topikTypeLabels";
import type { TopikQuestionType } from "../../lib/types";

/**
 * The full picker label for a TOPIK question type, in the app language, taken
 * from the dropdown frames (see ../../lib/topikTypeLabels). The API's `title_ko` /
 * `title_en` are generator descriptions, not UI labels, so they are used only
 * as the fallback for a code the map does not know yet — a question type added
 * server-side still renders rather than vanishing.
 */
function typeLabel(
  item: TopikQuestionType,
  language: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const ko = language === "ko";
  const fromFigma = (ko ? TOPIK_TYPE_LABEL_KO : TOPIK_TYPE_LABEL_EN)[item.code];
  if (fromFigma) return fromFigma;
  return t("session.topikTypeLabel", {
    n: item.number_label,
    title: ko ? item.title_ko : item.title_en?.trim() || item.title_ko,
  });
}

/**
 * The session's question-type picker for the chosen TOPIK part. Controlled:
 * the screen owns the open state and the type list, so both outlive the
 * collapsible panel this sits in.
 */
export function TopikTypeDropdown({
  options,
  value,
  open,
  onOpenChange,
  onSelect,
}: {
  options: TopikQuestionType[];
  value: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (code: string) => void;
}) {
  const { t, language } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Dismiss on an outside press / Escape — the list draws no backdrop of its
  // own, so nothing else would close it. Choosing a type is inside the panel,
  // so selection is untouched.
  useDismiss(panelRef, open, () => onOpenChange(false));

  const selected = value ? options.find((x) => x.code === value) : undefined;
  return (
    <div className="sess__dropdown" ref={panelRef}>
      <button className="sess__dropdown-field" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-haspopup="listbox">
        <span className={value ? "sess__dropdown-val" : "sess__dropdown-ph"}>
          {value ? (selected ? typeLabel(selected, language, t) : t("session.selected")) : t("session.topikTypePrompt")}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} stroke="#8a929a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="sess__dropdown-list" role="listbox" aria-label={t("session.topikTypeAria")}>
          {options.map((item) => (
            <li key={item.code} role="option" aria-selected={value === item.code}>
              <button
                className={`sess__dropdown-item ${value === item.code ? "is-selected" : ""}`}
                onClick={() => {
                  onOpenChange(false);
                  onSelect(item.code);
                }}
              >
                {typeLabel(item, language, t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
