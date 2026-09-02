import { useEffect, useRef } from "react";
import type { ReviewSessionCopy } from "../lib/reviewSessionCopy";
import { RewardMedal } from "./RewardMedal";
import closeIcon from "../assets/brand/ic-modal-close-brand.svg";

/**
 * Reward modal shown after a saved-item review is finalized (완료) — TAL-047
 * (KO 794:76247 / EN 1976:29376). Reuses the session-completion modal styling
 * (scomp) with review-specific copy.
 */
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
          <img className="scomp__close-icon" src={closeIcon} alt="" width={24} height={24} />
        </button>

        <span className="scomp__dot scomp__dot--1" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--2" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--3" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--4" aria-hidden="true" />

        <RewardMedal points={points} />

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
