import { CharacterArt } from "../components/brand/ProfileAssets";
import { CitrusOutline } from "../components/brand/AuthBrand";

/**
 * Onboarding introduction — the first visual screen of onboarding, shown before
 * the questions. Purely presentational: the primary button just transitions the
 * parent Onboarding screen into its question flow (no answer submit, no
 * completion). The three characters reuse the in-project Hangyul character art
 * (ProfileAssets) and the citrus outlines reuse CitrusOutline.
 */
export function OnboardingIntro({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen onbi">
      {/* Decorative citrus outlines — non-interactive, clipped by the edges. */}
      <div className="onbi__decor" aria-hidden="true">
        <CitrusOutline className="onbi__citrus onbi__citrus--tr" size={150} />
        <CitrusOutline className="onbi__citrus onbi__citrus--ml" size={170} />
        <CitrusOutline className="onbi__citrus onbi__citrus--bl" size={92} />
        <CitrusOutline className="onbi__citrus onbi__citrus--br" size={190} />
      </div>

      <div className="onbi__scroll">
        <div className="onbi__inner">
          <div className="onbi__grow onbi__grow--top" />

          <h1 className="onbi__title">환영합니다!</h1>
          <p className="onbi__desc">
            여러분의 학습 목표를 더 잘 이해하기 위해
            <br />
            간단한 질문 몇 가지를 준비했어요.
          </p>

          <div className="onbi__grow onbi__grow--mid" />

          {/* Character illustration (decorative group) */}
          <div className="onbi__art" role="img" aria-label="한귤 캐릭터들이 환영하는 그림">
            <div className="onbi__circle" />
            <span className="onbi__shadow" />
            <span className="onbi__char onbi__char--left">
              <CharacterArt variant="AVATAR_03" fill="100%" />
            </span>
            <span className="onbi__char onbi__char--right">
              <CharacterArt variant="AVATAR_02" fill="100%" />
            </span>
            <span className="onbi__char onbi__char--center">
              <CharacterArt variant="AVATAR_01" fill="100%" />
            </span>
          </div>

          <p className="onbi__msg">
            부담 갖지 마시고 편하게 답해 주세요.
            <br />
            여러분께 딱 맞는 학습 계획을 세우는 데 큰 도움이 될 거예요!
          </p>

          <div className="onbi__grow onbi__grow--bottom" />

          <button type="button" className="onbi__cta" onClick={onStart}>
            지금 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
