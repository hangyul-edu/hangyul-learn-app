import { useTranslation } from "../i18n";
/**
 * Personalized-learning session-completion summary modal (Conversation + TOPIK).
 *
 * Shown only when the session finished with at least one server-confirmed
 * correct item. There is no server session-summary endpoint, so the values are
 * mapped from the session's per-item server results: `correctCount` is the count
 * of server-confirmed correct answers, `points` is the sum of the answer API's
 * `points_earned`. Both X and 확인 run the same exit (onConfirm).
 */
function Medal({ points }: { points: number }) {
  return (
    <div className="scomp__medal" aria-hidden="true">
      <svg viewBox="0 0 120 120" className="scomp__medal-svg">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#F7C08A" strokeWidth="2.5" strokeDasharray="5 6" />
        {/* ribbon */}
        <path d="M44 30l10 26 6-4 6 4 10-26z" fill="#EF6B5B" />
        <path d="M50 30l10 22 10-22z" fill="#D9534A" />
        {/* medal */}
        <circle cx="60" cy="72" r="26" fill="#F2A93B" />
        <circle cx="60" cy="72" r="26" fill="url(#medalShine)" />
        <circle cx="60" cy="72" r="20" fill="none" stroke="#E1902C" strokeWidth="2" />
        <path d="M60 60l3.6 7.4 8.1 1-5.9 5.6 1.5 8L60 79.3 52.7 83l1.5-8-5.9-5.6 8.1-1L60 60z" fill="#fff7e0" />
        <defs>
          <radialGradient id="medalShine" cx="0.38" cy="0.32" r="0.7">
            <stop offset="0" stopColor="#ffdc7e" stopOpacity="0.9" />
            <stop offset="0.6" stopColor="#ffdc7e" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="scomp__points">+{points}P</span>
    </div>
  );
}

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
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#F2762A" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <span className="scomp__dot scomp__dot--1" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--2" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--3" aria-hidden="true" />
        <span className="scomp__dot scomp__dot--4" aria-hidden="true" />

        <Medal points={points} />

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
