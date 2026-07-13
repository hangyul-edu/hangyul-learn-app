import { CharacterArt } from "../components/brand/ProfileAssets";

/**
 * Speaking-level options. `id` is the stable backend `speaking_level` value
 * (onboarding schema `Literal["beginner","elementary","intermediate",
 * "advanced","fluent"]`); `label` is the visible copy. Order = increasing
 * ability, matching the reference. Labels are never sent to the API.
 */
const LEVELS: { id: string; label: string }[] = [
  { id: "beginner", label: "처음이에요" },
  { id: "elementary", label: "단어만" },
  { id: "intermediate", label: "간단한 문장" },
  { id: "advanced", label: "일상 대화" },
  { id: "fluent", label: "유창" },
];

/** Decorative lower-right character (reuses AVATAR_01) with a soft shadow and
 *  two small held props. Non-interactive. */
function SpeakingCharacter() {
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
 * First conversation-track onboarding question — Korean speaking level. Faithful
 * visual for the existing Onboarding step 1 (conversation branch); it owns no
 * state or API logic. The parent keeps the `speaking` draft (a stable
 * `speaking_level` id) and the branch routing; selecting a card only updates
 * that draft, and 다음 advances to the next conversation question.
 */
export function OnboardingSpeaking({
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

          <h1 className="onbq__q">한국어 말하기 수준은 어느 정도인가요?</h1>

          <div className="onbq__answers" role="radiogroup" aria-label="한국어 말하기 수준">
            {LEVELS.map((lv) => (
              <button
                key={lv.id}
                type="button"
                className={`onbq__answer ${value === lv.id ? "is-selected" : ""}`}
                role="radio"
                aria-checked={value === lv.id}
                aria-label={lv.label}
                onClick={() => onSelect(lv.id)}
              >
                {lv.label}
              </button>
            ))}
          </div>

          <div className="onbq__spacer" />

          <SpeakingCharacter />

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
