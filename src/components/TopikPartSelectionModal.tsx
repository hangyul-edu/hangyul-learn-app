import { useEffect, useRef, useState } from "react";

import type { TopikSection } from "../lib/types";

/** English API value → Korean label. Order matches the reference (듣기 first). */
const OPTIONS: { value: TopikSection; label: string }[] = [
  { value: "listening", label: "듣기" },
  { value: "reading", label: "읽기" },
  { value: "writing", label: "쓰기" },
];

/**
 * Mandatory TOPIK part-selection modal, shown before a TOPIK personalized
 * session starts. The user picks 듣기 / 읽기 / 쓰기 (listening / reading / writing);
 * pressing 시작할게요! calls `onStart(part)` so the parent can enter the session
 * with the chosen section. Closing (X / backdrop / Escape) starts nothing.
 *
 * Selection defaults to Listening and resets to it every time the modal opens.
 * The conversation flow never renders this — it's TOPIK-only.
 */
export function TopikPartSelectionModal({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (part: TopikSection) => void;
}) {
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
        <button className="tpart__close" onClick={onClose} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <p className="tpart__eyebrow">오늘은 어떤 파트를 학습해볼까요?</p>
        <h2 className="tpart__title" id="tpart-title">학습할 파트를 선택하세요</h2>

        <div className="tpart__options" role="radiogroup" aria-labelledby="tpart-title">
          {OPTIONS.map((o) => {
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
                {o.label}
              </button>
            );
          })}
        </div>

        <button
          className="tpart__cta"
          onClick={() => onStart(selected)}
          aria-label={`${OPTIONS.find((o) => o.value === selected)?.label} 파트로 학습 시작할게요`}
        >
          시작할게요!
        </button>
      </div>
    </div>
  );
}
