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
  return (
    <RewardModal
      points={points}
      title={copy.rewardTitle}
      subtitle={copy.rewardSubtitle}
      pointsA11y={copy.rewardA11y(points)}
      confirmLabel={copy.confirm}
      closeA11y={copy.closeA11y}
      onConfirm={onConfirm}
    />
  );
}

/**
 * The medal reward card (scomp): the review reward above and the
 * watch-complete reward on the course page (COU-021 794:76312) are the same
 * component with different copy. The points are server-authoritative.
 */
export function RewardModal({
  points,
  title,
  subtitle,
  pointsA11y,
  confirmLabel,
  closeA11y,
  onConfirm,
}: {
  points: number;
  title: string;
  subtitle: string;
  pointsA11y: string;
  confirmLabel: string;
  closeA11y: string;
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
    <div className="scomp" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scomp__backdrop" onClick={onConfirm} />
      <div className="scomp__card">
        <button className="scomp__close" onClick={onConfirm} aria-label={closeA11y}>
          <img className="scomp__close-icon" src={closeIcon} alt="" width={24} height={24} />
        </button>

        <span className="scomp__dot scomp__dot--1" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--2" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--3" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--4" aria-hidden="true" />

        <RewardMedal points={points} />

        <h2 className="scomp__title">{title}</h2>
        <p className="scomp__summary" aria-label={pointsA11y}>
          {subtitle}
        </p>

        <button ref={confirmRef} className="scomp__confirm" onClick={onConfirm} aria-label={confirmLabel}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
