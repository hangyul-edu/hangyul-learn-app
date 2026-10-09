import { useEffect, useRef, useState } from "react";
import { useTranslation, type TranslationKey } from "../i18n";

import type { TopikSection } from "../lib/types";

/** API value → catalog key. Order matches the reference (듣기 / Listening first). */
const OPTIONS: { value: TopikSection; label: TranslationKey }[] = [
  { value: "listening", label: "session.partListening" },
  { value: "reading", label: "session.partReading" },
  { value: "writing", label: "session.partWriting" },
];

/** TOPIK I (grades 1–2) has no writing section; writing starts with TOPIK II (grade 3). */
export const TOPIK_WRITING_MIN_GRADE = 3;

/** The parts a learner at TOPIK `grade` can pick. Unknown grade → all parts. */
export function topikSectionsFor(grade: number | null | undefined): TopikSection[] {
  return OPTIONS.map((o) => o.value).filter(
    (v) => v !== "writing" || grade == null || grade >= TOPIK_WRITING_MIN_GRADE,
  );
}

/**
 * Mandatory TOPIK part-selection modal, shown before a TOPIK personalized
 * session starts. The user picks 듣기 / 읽기 / 쓰기 (listening / reading / writing);
 * pressing 시작할게요! calls `onStart(part)` so the parent can enter the session
 * with the chosen section. Closing (X / backdrop / Escape) starts nothing.
 *
 * Selection defaults to Listening and resets to it every time the modal opens.
 * The conversation flow never renders this — it's TOPIK-only.
 *
 * `level` is the learner's TOPIK grade (the dashboard's TOPIK track level):
 * at grades 1–2 (TOPIK I) 쓰기 is not offered, since that exam has no writing.
 */
export function TopikPartSelectionModal({
  open,
  level,
  onClose,
  onStart,
}: {
  open: boolean;
  level?: number | null;
  onClose: () => void;
  onStart: (part: TopikSection) => void;
}) {
  const { t } = useTranslation();
  const allowed = topikSectionsFor(level);
  const options = OPTIONS.filter((o) => allowed.includes(o.value));
  const [selected, setSelected] = useState<TopikSection>("listening");
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected("listening"); // reset each open
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // no background scroll

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center" onClick={onClose}>
      <div
        ref={dialogRef}
        className="tpart"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tpart-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="tpart__close" onClick={onClose} aria-label={t("session.additionalCloseA11y")}>
          {/* Figma ic_B_topNav — two 16px diagonals, 1.5 round stroke, in a 24 box. */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 4L20 20" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M20 4L4 20" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <p className="tpart__eyebrow">{t("session.partTitle")}</p>
        <h2 className="tpart__title" id="tpart-title">{t("session.partSubtitle")}</h2>

        <div className="tpart__options" role="radiogroup" aria-labelledby="tpart-title">
          {options.map((o) => {
            const active = o.value === selected;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`tpart__option${active ? " tpart__option--active" : ""}`}
                onClick={() => setSelected(o.value)}
              >
                {t(o.label)}
              </button>
            );
          })}
        </div>

        <button
          className="tpart__cta"
          onClick={() => onStart(selected)}
          aria-label={t("session.partA11y", {
            label: t(OPTIONS.find((o) => o.value === selected)?.label ?? "session.partReading"),
          })}
        >
          {t("session.additionalStart")}
        </button>
      </div>
    </div>
  );
}
