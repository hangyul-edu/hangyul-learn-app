import type { SessionConversationCopy } from "../../lib/sessionConversationCopy";

/** Clamp any returned score to a safe 0–100 integer for display + a11y. */
export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Voice-only pronunciation feedback: score ring + one actionable message. */
export function PronunciationPanel({
  score,
  message,
  copy,
}: {
  score: number;
  message: string;
  copy: SessionConversationCopy;
}) {
  const percent = clampScore(score);
  return (
    <div className="sess__pron" role="group" aria-label={copy.scoreA11y(percent)}>
      <ScoreRing percent={percent} />
      <div className="sess__pron-text">
        <div className="sess__pron-title">{copy.pronunciationTitle}</div>
        <p className="sess__pron-msg">{message}</p>
      </div>
    </div>
  );
}

/** Circular pronunciation-accuracy ring: gray inactive track + orange active arc
 * with the clamped percentage centered. Decorative — the accessible value is
 * announced by the panel's group label. */
function ScoreRing({ percent }: { percent: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      className="sess__pron-ring"
      width="63"
      height="63"
      viewBox="0 0 66 66"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="33" cy="33" r={radius} fill="none" stroke="#ecedf0" strokeWidth="7" />
      <circle
        cx="33"
        cy="33"
        r={radius}
        fill="none"
        stroke="#ff8a3d"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        transform="rotate(-90 33 33)"
      />
      <text
        x="33"
        y="34"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight="800"
        fill="#262c31"
      >
        {percent}%
      </text>
    </svg>
  );
}
