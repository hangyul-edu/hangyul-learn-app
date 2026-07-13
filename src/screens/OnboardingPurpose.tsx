import { CharacterArt } from "../components/brand/ProfileAssets";

type Purpose = "conversation" | "topik";

/** Orange side-profile head with speech lines (conversation). */
function SpeakingIcon() {
  return (
    <svg width="54" height="54" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path
        d="M40 15c-11 0-20 8-20 18 0 4 1.6 7.7 4.3 10.6-.5 3.2-2 6-4 7.9-.6.6-.2 1.6.6 1.6 4.2 0 8-1.5 10.9-3.9 2.5.9 5.3 1.4 8.2 1.4 11 0 20-8 20-18S51 15 40 15z"
        fill="#FF5B00"
      />
      <circle cx="34" cy="33" r="2.4" fill="#fff" />
      <circle cx="42" cy="33" r="2.4" fill="#fff" />
      <path d="M50 24c3 2 4.6 5 4.6 9M55 20c4 3 6 7 6 13" stroke="#FF5B00" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Small colorful pencil (TOPIK). */
function PencilIcon() {
  return (
    <svg width="46" height="52" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
      <g transform="rotate(20 24 28)">
        <rect x="18" y="8" width="12" height="30" rx="2" fill="#5AA9F4" />
        <rect x="18" y="8" width="12" height="6" rx="2" fill="#F58BB0" />
        <path d="M18 38h12l-6 9z" fill="#F4C542" />
        <path d="M21.2 42.5h5.6l-2.8 4.5z" fill="#2C333B" />
        <line x1="24" y1="14" x2="24" y2="38" stroke="#3E86D0" strokeWidth="1" opacity="0.5" />
      </g>
      <ellipse cx="24" cy="52" rx="9" ry="2.2" fill="#2C333B" opacity="0.18" />
    </svg>
  );
}

/** Decorative bottom character (reuses AVATAR_03) with an incomplete orange
 *  ring and a few light-gray accent strokes. Non-interactive. */
function PurposeCharacter() {
  return (
    <div className="onbq__art" aria-hidden="true">
      <svg className="onbq__ring" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#FF5B00" strokeWidth="2" strokeLinecap="round" strokeDasharray="205 78" transform="rotate(-40 50 50)" />
      </svg>
      <span className="onbq__char">
        <CharacterArt variant="AVATAR_03" fill="100%" />
      </span>
      <svg className="onbq__strokes" viewBox="0 0 40 40">
        <path d="M6 30l7-7M14 33l8-8M23 35l6-6" stroke="#D5DADE" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * First onboarding question — learning-purpose (track) selection. This is the
 * faithful visual for the existing Onboarding step 0; it owns no state or API
 * logic. The parent Onboarding screen keeps the `purpose` draft and the branch
 * routing; selecting a card only updates that draft, and 다음 advances to the
 * branch's first question.
 */
export function OnboardingPurpose({
  purpose,
  onSelect,
  onBack,
  onNext,
  progress,
}: {
  purpose: Purpose | null;
  onSelect: (p: Purpose) => void;
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

          <h1 className="onbq__q">
            한국어를 어떤 목적으로
            <br />
            배우고 싶으신가요?
          </h1>

          <div className="onbq__cards" role="radiogroup" aria-label="학습 목적 선택">
            <button
              type="button"
              className={`onbq__card onbq__card--conv ${purpose === "conversation" ? "is-selected" : ""}`}
              role="radio"
              aria-checked={purpose === "conversation"}
              aria-label="회화, 말하기 중심"
              onClick={() => onSelect("conversation")}
            >
              <span className="onbq__card-icon">
                <SpeakingIcon />
              </span>
              <span className="onbq__card-title onbq__card-title--conv">회화</span>
              <span className="onbq__card-sub onbq__card-sub--conv">(말하기 중심)</span>
            </button>

            <button
              type="button"
              className={`onbq__card onbq__card--topik ${purpose === "topik" ? "is-selected" : ""}`}
              role="radio"
              aria-checked={purpose === "topik"}
              aria-label="TOPIK, 시험 대비"
              onClick={() => onSelect("topik")}
            >
              <span className="onbq__card-icon">
                <PencilIcon />
              </span>
              <span className="onbq__card-title onbq__card-title--topik">TOPIK</span>
              <span className="onbq__card-sub onbq__card-sub--topik">(시험 대비)</span>
            </button>
          </div>

          <PurposeCharacter />

          <div className="onbq__spacer" />

          <button
            type="button"
            className="onbq__next"
            onClick={onNext}
            disabled={!purpose}
            aria-disabled={!purpose}
            aria-label="다음"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
