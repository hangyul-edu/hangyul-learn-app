import { useEffect, useRef } from "react";
import type { ReviewSessionCopy } from "../lib/reviewSessionCopy";

/**
 * Reward modal shown after a saved-item review is finalized (완료). Reuses the
 * session-completion modal styling (scomp) with review-specific copy. The points
 * amount is server-authoritative — never hardcoded.
 */
function Medal({ points }: { points: number }) {
  return (
    <div className="scomp__medal" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="scomp__medal-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#F7C08A" strokeWidth="2.5" strokeDasharray="5 6" />
        <path d="M44 30l10 26 6-4 6 4 10-26z" fill="#EF6B5B" />
        <path d="M50 30l10 22 10-22z" fill="#D9534A" />
        <circle cx="60" cy="72" r="26" fill="#F2A93B" />
        <circle cx="60" cy="72" r="26" fill="url(#reviewMedalShine)" />
        <circle cx="60" cy="72" r="20" fill="none" stroke="#E1902C" strokeWidth="2" />
        <path d="M60 60l3.6 7.4 8.1 1-5.9 5.6 1.5 8L60 79.3 52.7 83l1.5-8-5.9-5.6 8.1-1L60 60z" fill="#fff7e0" />
        <defs>
          <radialGradient id="reviewMedalShine" cx="0.38" cy="0.32" r="0.7">
            <stop offset="0" stopColor="#ffdc7e" stopOpacity="0.9" />
            <stop offset="0.6" stopColor="#ffdc7e" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="scomp__points">+{points}P</span>
    </div>
  );
}

export function ReviewRewardModal({
  points,
  copy,
  onConfirm,
}: {
  points: number;
  copy: ReviewSessionCopy;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Move focus to the confirm button on open, and let Escape dismiss (same as
  // 확인 / the close icon) so keyboard and back-gesture users can leave cleanly.
  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm]);

  return (
    <div className="scomp" role="dialog" aria-modal="true" aria-label={copy.rewardTitle}>
      <div className="scomp__backdrop" onClick={onConfirm} />
      <div className="scomp__card">
        <button className="scomp__close" onClick={onConfirm} aria-label={copy.closeA11y}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#F2762A" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="scomp__dot scomp__dot--1" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--2" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--3" aria-hidden="true" />

        <Medal points={points} />

        <h2 className="scomp__title">{copy.rewardTitle}</h2>
        <p className="scomp__summary" aria-label={copy.rewardA11y(points)}>
          {copy.rewardSubtitle}
        </p>

        <button ref={confirmRef} className="scomp__confirm" onClick={onConfirm} aria-label={copy.confirm}>
          {copy.confirm}
        </button>
      </div>
    </div>
  );
}
