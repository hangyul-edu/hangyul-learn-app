import { useTranslation, type TranslationKey } from "../i18n";
import { OnboardingShell, OnboardingOption } from "./OnboardingShell";
import mascotWave from "../assets/brand/onb-mascot-wave.svg";

/**
 * Speaking-level options. `id` is the stable backend `speaking_level` value
 * (onboarding schema `Literal["beginner","elementary","intermediate",
 * "advanced","fluent"]`); `label` is the visible copy. Order = increasing
 * ability, matching the reference. Labels are never sent to the API.
 */
const LEVELS: { id: string; label: TranslationKey }[] = [
  { id: "beginner", label: "onboarding.speakingNone" },
  { id: "elementary", label: "onboarding.speakingWords" },
  { id: "intermediate", label: "onboarding.speakingSimple" },
  { id: "advanced", label: "onboarding.speakingDaily" },
  { id: "fluent", label: "onboarding.speakingFluent" },
];

/**
 * First conversation-track onboarding question — Korean speaking level. Figma
 * AUR-003 (KO 40:6921, EN 784:53576). It owns no state or API logic: the parent
 * keeps the `speaking` draft (a stable `speaking_level` id) and the branch
 * routing; selecting a row only updates that draft, and 다음 advances.
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
  const { t } = useTranslation();

  return (
    <OnboardingShell progress={progress} onBack={onBack}>
      <h1 className="onbq__q">{t("onboarding.speakingQ")}</h1>

      <div className="onbq__answers" role="radiogroup" aria-label={t("onboarding.speakingA11y")}>
        {LEVELS.map((lv) => (
          <OnboardingOption
            key={lv.id}
            label={t(lv.label)}
            selected={value === lv.id}
            onSelect={() => onSelect(lv.id)}
            a11y={t(lv.label)}
          />
        ))}
      </div>

      {/* Group 1410118495 (222:7059) — 148.05x122 at (200, 583). */}
      <img className="onbq__art onbq__art--wave" src={mascotWave} alt="" aria-hidden="true" />

      <button
        type="button"
        className="onbq__next"
        onClick={onNext}
        disabled={!value}
        aria-disabled={!value}
      >
        {t("onboarding.next")}
      </button>
    </OnboardingShell>
  );
}
