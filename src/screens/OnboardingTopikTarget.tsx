import { useTranslation, type TranslationKey } from "../i18n";
import { OnboardingShell, OnboardingOption } from "./OnboardingShell";
import mascotWave from "../assets/brand/onb-mascot-wave.svg";

/**
 * TOPIK target-grade options. `id` is the stable backend `topik_target` value
 * (onboarding schema `Literal["1","2","3","4","5","6"]`); `badge` is the visible
 * proficiency label. Grade 1 carries the two-tone recommendation badge. The
 * badge labels are never sent to the API.
 */
const GRADES: { id: string; badge: TranslationKey; rec?: boolean }[] = [
  { id: "1", badge: "onboarding.topikBasic", rec: true },
  { id: "2", badge: "onboarding.topikBeginner" },
  { id: "3", badge: "onboarding.topikIntermediate" },
  { id: "4", badge: "onboarding.topikUpperIntermediate" },
  { id: "5", badge: "onboarding.topikAdvanced" },
  { id: "6", badge: "onboarding.topikMastery" },
];

/**
 * First TOPIK-track onboarding question — target grade. Figma AUR-005 (KO
 * 1802:24099, EN 1803:24240). It owns no state or API logic: the parent keeps
 * the `topikTarget` draft (a stable `topik_target` id) and the branch routing.
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
  const { t } = useTranslation();

  return (
    <OnboardingShell progress={progress} onBack={onBack}>
      <h1 className="onbq__q">{t("onboarding.topikQ")}</h1>

      <div className="onbq__answers" role="radiogroup" aria-label={t("onboarding.topikA11y")}>
        {GRADES.map((g) => (
          <OnboardingOption
            key={g.id}
            label={t("onboarding.gradeLabel", { n: g.id })}
            badge={t(g.badge)}
            recommended={g.rec}
            selected={value === g.id}
            onSelect={() => onSelect(g.id)}
            a11y={t("onboarding.gradeOptionA11y", { n: g.id, badge: t(g.badge) })}
          />
        ))}
      </div>

      {/* Group 1410118495 (1802:24138) — 148.05x122 at (200, 583). */}
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
