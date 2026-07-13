import { CharacterArt } from "../components/brand/ProfileAssets";

/**
 * TOPIK target-grade options. `id` is the stable backend `topik_target` value
 * (onboarding schema `Literal["1","2","3","4","5","6"]`); `badge` is the visible
 * proficiency label. Grade 1 carries the two-tone recommendation badge. The
 * badge labels are never sent to the API.
 */
const GRADES: { id: string; badge: string; rec?: boolean }[] = [
  { id: "1", badge: "추천 기초", rec: true },
  { id: "2", badge: "초급" },
  { id: "3", badge: "중급" },
  { id: "4", badge: "중상급" },
  { id: "5", badge: "고급" },
  { id: "6", badge: "최상급" },
];

/** Decorative lower-right character (reuses AVATAR_01) with a soft shadow and
 *  two small held props. Non-interactive. */
function TopikCharacter() {
  return (
    <div className="onbs__art" aria-hidden="true">
      <span className="onbs__prop onbs__prop--teal" />
      <span className="onbs__prop onbs__prop--orange" />
      <span className="onbs__char">
        <CharacterArt variant="AVATAR_01" fill="100%" />
      </span>
      <span className="onbs__shadow" />
    </div>
  );
}

/**
 * First TOPIK-track onboarding question — target grade. Faithful visual for the
 * existing Onboarding step 1 (TOPIK branch); it owns no state or API logic. The
 * parent keeps the `topikTarget` draft (a stable `topik_target` id) and the
 * branch routing; selecting a card only updates that draft, and 다음 advances to
 * the next TOPIK question.
 */
export function OnboardingTopikTarget({
  value,
  onSelect,
  onBack,
  onNext,
  progress,
}: {
  value: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  /** 0–1 position of this question in the flow (drives the progress bar). */
  progress: number;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="screen onbq">
      <div className="onbq__scroll">
        <div className="onbq__inner">
          <button className="onbq__back" onClick={onBack} aria-label="뒤로">
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

          <h1 className="onbq__q">함께 목표할 TOPIK 급수를 골라주세요</h1>

          <div className="onbq__answers" role="radiogroup" aria-label="목표 TOPIK 급수">
            {GRADES.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`onbg__card ${value === g.id ? "is-selected" : ""}`}
                role="radio"
                aria-checked={value === g.id}
                aria-label={`${g.id}급, ${g.badge}`}
                onClick={() => onSelect(g.id)}
              >
                <span className="onbg__qty">{g.id}급</span>
                {g.rec ? (
                  <span className="onbg__pill onbg__pill--rec">
                    <span className="onbg__pill-hl">추천</span> 기초
                  </span>
                ) : (
                  <span className="onbg__pill">{g.badge}</span>
                )}
              </button>
            ))}
          </div>

          <div className="onbq__spacer" />

          <TopikCharacter />

          <button
            type="button"
            className="onbq__next"
            onClick={onNext}
            disabled={!value}
            aria-disabled={!value}
            aria-label="다음"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
