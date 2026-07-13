import { CharacterArt } from "../components/brand/ProfileAssets";

/**
 * Daily-goal options. `n` is the stable backend value (onboarding schema
 * `daily_sentence_goal: Literal[5,10,20,30,40]`); `mode` is the visible pill
 * label. The integer is submitted — labels are never sent to the API.
 */
const GOALS: { n: number; mode: string; rec?: boolean }[] = [
  { n: 5, mode: "기본 모드" },
  { n: 10, mode: "추천 루틴 모드", rec: true },
  { n: 20, mode: "집중 모드" },
  { n: 30, mode: "몰입 모드" },
  { n: 40, mode: "정복 모드" },
];

/** Decorative green-cap character (reuses AVATAR_02) standing beside a row of
 *  pale-pink stepping stones. Non-interactive. */
function GoalCharacter() {
  return (
    <div className="onbg__art" aria-hidden="true">
      <span className="onbg__char">
        <CharacterArt variant="AVATAR_02" fill="100%" />
      </span>
      <span className="onbg__stones">
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/**
 * Final conversation-track onboarding question — daily sentence goal. Faithful
 * visual for the existing Onboarding step 2 (conversation branch); it owns no
 * state or API logic. The parent keeps the `goal` draft and calls the existing
 * `submit()` on the CTA, which completes onboarding server-side (level
 * assignment + navigation) only on success.
 */
export function OnboardingDailyGoal({
  value,
  onSelect,
  onBack,
  onSubmit,
  busy,
  progress,
}: {
  value: number;
  onSelect: (n: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  /** 0–1 position of this question in the flow (drives the progress bar). */
  progress: number;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const valid = GOALS.some((g) => g.n === value);

  return (
    <div className="screen onbq">
      <div className="onbq__scroll">
        <div className="onbq__inner">
          <button className="onbq__back" onClick={onBack} aria-label="뒤로" disabled={busy}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div
            className="onbq__progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="온보딩 진행률"
          >
            <div className="onbq__progress-fill" style={{ width: `${pct}%` }} />
          </div>

          <div className="onbg__heading">
            <p className="onbg__q1">마지막 질문이에요!</p>
            <h1 className="onbg__q2">하루에 몇 문장씩 연습할까요?</h1>
          </div>

          <div className="onbq__answers" role="radiogroup" aria-label="하루 학습 목표">
            {GOALS.map((g) => (
              <button
                key={g.n}
                type="button"
                className={`onbg__card ${value === g.n ? "is-selected" : ""}`}
                role="radio"
                aria-checked={value === g.n}
                aria-label={`${g.n}개, ${g.mode}`}
                onClick={() => onSelect(g.n)}
              >
                <span className="onbg__qty">{g.n}개</span>
                {g.rec ? (
                  <span className="onbg__pill onbg__pill--rec">
                    <span className="onbg__pill-hl">추천</span> 루틴 모드
                  </span>
                ) : (
                  <span className="onbg__pill">{g.mode}</span>
                )}
              </button>
            ))}
          </div>

          <div className="onbq__spacer" />

          <GoalCharacter />

          <button
            type="button"
            className="onbq__next"
            onClick={onSubmit}
            disabled={busy || !valid}
            aria-disabled={busy || !valid}
            aria-label="바로 시작하기"
          >
            {busy ? <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2.5 }} /> : "바로 시작하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
