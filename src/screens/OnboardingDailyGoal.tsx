import { useTranslation, type TranslationKey } from "../i18n";
import { OnboardingShell, OnboardingOption } from "./OnboardingShell";
import mascotSteps from "../assets/brand/onb-mascot-steps.svg";
import { Spinner } from "../components/ui/Spinner";

/**
 * Daily-goal options. `n` is the stable backend value (onboarding schema
 * `daily_sentence_goal: Literal[5,10,20,30,40]`); `mode` is the visible pill
 * label. The integer is submitted — labels are never sent to the API.
 */
const GOALS: { n: number; mode: TranslationKey; badge?: TranslationKey; rec?: boolean }[] = [
  { n: 5, mode: "onboarding.goalBasic" },
  // The recommended pill prints a tinted "Best"/"추천" of its own, so its badge
  // carries only the mode name. `mode` stays the whole label ("Best Routine")
  // because that is what the screen reader should announce.
  { n: 10, mode: "onboarding.goalRoutine", badge: "onboarding.goalRoutineBase", rec: true },
  { n: 20, mode: "onboarding.goalFocus" },
  { n: 30, mode: "onboarding.goalImmersion" },
  { n: 40, mode: "onboarding.goalConquer" },
];

/**
 * Final onboarding question — daily goal. Figma AUR-004: the sentence branch is
 * KO 2149:24792 / EN 784:53665 and the question branch KO 2149:24877 / EN
 * AUR-006 1803:24464. Only the heading and the free-plan notice differ.
 *
 * Unlike the other question screens this one puts its CTA in `cp_tab` (a white
 * 98px footer), so the button sits 39px off the bottom instead of 34px, and the
 * whole content column flows from y=154 rather than being pinned at y=179.
 *
 * It owns no state or API logic: the parent keeps the `goal` draft and calls
 * `submit()` on the CTA, which sends the branch-correct field and completes
 * onboarding server-side (level assignment + navigation) only on success.
 */
export function OnboardingDailyGoal({
  value,
  onSelect,
  onBack,
  onSubmit,
  busy,
  progress,
  heading,
  notice,
}: {
  value: number;
  onSelect: (n: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  busy: boolean;
  /** 0–1 position of this question in the flow (drives the progress bar). */
  progress: number;
  /** The second heading line (branch-specific: sentences vs. questions). */
  heading: string;
  /** The free-plan notice (branch-specific, same two-line box). */
  notice: string;
}) {
  const { t } = useTranslation();
  const valid = GOALS.some((g) => g.n === value);

  return (
    <OnboardingShell progress={progress} onBack={onBack} backDisabled={busy}>
      <div className="onbg__col">
        <div className="onbg__heading">
          <p className="onbg__q1">{t("onboarding.goalLast")}</p>
          <h1 className="onbg__q2">{heading}</h1>
        </div>

        <p className="onbg__notice">{notice}</p>

        <div className="onbg__answers" role="radiogroup" aria-label={t("onboarding.goalA11y")}>
          {GOALS.map((g) => (
            <OnboardingOption
              key={g.n}
              label={t("onboarding.sentenceCount", { n: g.n })}
              badge={t(g.badge ?? g.mode)}
              recommended={g.rec}
              selected={value === g.n}
              onSelect={() => onSelect(g.n)}
              a11y={t("onboarding.goalOptionA11y", { n: g.n, mode: t(g.mode) })}
            />
          ))}
        </div>
      </div>

      {/* Group 1410118493 (2149:24811) — 210.54x92.84 at (133, 600.4). */}
      <img className="onbq__art onbq__art--steps" src={mascotSteps} alt="" aria-hidden="true" />

      <button
        type="button"
        className="onbq__next onbq__next--tab"
        onClick={onSubmit}
        disabled={busy || !valid}
        aria-disabled={busy || !valid}
        aria-label={t("onboarding.goStart")}
      >
        {busy ? <Spinner size={24} stroke={2.5} /> : t("onboarding.goStart")}
      </button>
    </OnboardingShell>
  );
}
