import { useTranslation } from "../i18n";
import { OnboardingShell } from "./OnboardingShell";
import mascotRing from "../assets/brand/onb-mascot-ring.svg";
import iconSpeaking from "../assets/brand/onb-icon-speaking.svg";
import iconTopik from "../assets/brand/onb-icon-topik.svg";

type Purpose = "conversation" | "topik";

/**
 * First onboarding question — learning-purpose (track) selection. Figma AUR-002
 * (KO 67:6111, EN 784:54432): two 202-tall cards at y=247, the speaking card at
 * x=18 (164.29 wide) and the TOPIK card at x=193.88 (165.12 wide), each with a
 * ~30px icon, a Bold 30 title and a Bold 12 subtitle.
 *
 * It owns no state or API logic: the parent Onboarding screen keeps the
 * `purpose` draft and the branch routing.
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
  const { t } = useTranslation();

  return (
    <OnboardingShell progress={progress} onBack={onBack}>
      <h1 className="onbq__q onbq__q--two">
        {t("onboarding.purposeLine1")}
        <br />
        {t("onboarding.purposeLine2")}
      </h1>

      <div className="onbq__cards" role="radiogroup" aria-label={t("onboarding.purposeA11y")}>
        <button
          type="button"
          className={`onbq__card onbq__card--conv${purpose === "conversation" ? " is-selected" : ""}`}
          role="radio"
          aria-checked={purpose === "conversation"}
          aria-label={t("onboarding.purposeConvA11y")}
          onClick={() => onSelect("conversation")}
        >
          <img className="onbq__card-icon onbq__card-icon--conv" src={iconSpeaking} alt="" aria-hidden="true" />
          <span className="onbq__card-title">{t("onboarding.purposeConv")}</span>
          <span className="onbq__card-sub">{t("onboarding.purposeConvSub")}</span>
        </button>

        <button
          type="button"
          className={`onbq__card onbq__card--topik${purpose === "topik" ? " is-selected" : ""}`}
          role="radio"
          aria-checked={purpose === "topik"}
          aria-label={t("onboarding.purposeTopikA11y")}
          onClick={() => onSelect("topik")}
        >
          <img className="onbq__card-icon onbq__card-icon--topik" src={iconTopik} alt="" aria-hidden="true" />
          <span className="onbq__card-title">{t("onboarding.purposeTopik")}</span>
          <span className="onbq__card-sub">{t("onboarding.purposeTopikSub")}</span>
        </button>
      </div>

      {/* Group 1410118328 (67:6211) — 140.48x130 at (117, 513). */}
      <img className="onbq__art onbq__art--ring" src={mascotRing} alt="" aria-hidden="true" />

      <button
        type="button"
        className="onbq__next"
        onClick={onNext}
        disabled={!purpose}
        aria-disabled={!purpose}
      >
        {t("onboarding.next")}
      </button>
    </OnboardingShell>
  );
}
