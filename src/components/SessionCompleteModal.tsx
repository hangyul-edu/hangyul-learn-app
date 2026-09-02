import { useTranslation } from "../i18n";
import { RewardMedal } from "./RewardMedal";
import closeIcon from "../assets/brand/ic-modal-close-brand.svg";

/**
 * Personalized-learning session-completion summary modal (Conversation + TOPIK).
 *
 * Shown only when the session finished with at least one server-confirmed
 * correct item. There is no server session-summary endpoint, so the values are
 * mapped from the session's per-item server results: `correctCount` is the count
 * of server-confirmed correct answers, `points` is the sum of the answer API's
 * `points_earned`. Both X and 확인 run the same exit (onConfirm).
 */
export function SessionCompleteModal({
  mode,
  correctCount,
  points,
  onConfirm,
}: {
  mode: "conversation" | "topik";
  correctCount: number;
  points: number;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const unit = t(mode === "topik" ? "session.unitQuestion" : "session.unitSentence");
  return (
    <div className="scomp" role="dialog" aria-modal="true" aria-label={t("session.completeA11y")}>
      <div className="scomp__backdrop" onClick={onConfirm} />
      <div className="scomp__card">
        <button className="scomp__close" onClick={onConfirm} aria-label={t("session.completeCloseA11y")}>
          <img className="scomp__close-icon" src={closeIcon} alt="" width={24} height={24} />
        </button>

        <span className="scomp__dot scomp__dot--1" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--2" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--3" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--4" aria-hidden="true" />

        <RewardMedal points={points} />

        <h2 className="scomp__title">{t("session.completeTitle")}</h2>
        <p
          className="scomp__summary"
          aria-label={t("session.completeSummaryA11y", { count: correctCount, unit, points })}
        >
          {t("session.completeCount", { count: correctCount, unit })}
        </p>

        <button className="scomp__confirm" onClick={onConfirm} aria-label={t("common.confirm")}>
          {t("common.confirm")}
        </button>
      </div>
    </div>
  );
}
