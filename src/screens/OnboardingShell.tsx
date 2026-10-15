import type { ReactNode } from "react";
import { useTranslation } from "../i18n";
import { BackChevronIcon } from "../components/brand/Glyphs";

/**
 * Shared chrome for the onboarding question screens — Figma AUR-002 (67:6111),
 * AUR-003 (40:6921), AUR-004 (2149:24792) and AUR-005 (1802:24099) all use the
 * same 375x812 canvas:
 *
 *   back      cp_B_01_topNav — 50px bar at y=44, 20px gutters, 24px glyph
 *   progress  335x4 track (#ECEDF0, r24) at (20, 111); the fill is Vector 1242,
 *             a 331-wide line inset 2px at both ends
 *   question  285 wide at x=45, top 179 — Heading 8 (SemiBold 18 / 25.2)
 *   options   285 wide at x=45, top 232
 *   art       per-screen mascot, absolutely placed
 *   cta       cp_C_01_primaryBtn, 20px gutters, disabled fill #ADB4BA
 *
 * The web app draws no status bar, so every `top` below is `figma-y − 44`
 * expressed as a percentage of the 375x768 body.
 */
export function OnboardingShell({
  progress,
  onBack,
  backDisabled,
  children,
}: {
  /** 0–1 position of this question in the flow (drives the progress bar). */
  progress: number;
  onBack: () => void;
  backDisabled?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="screen onbq">
      <button className="onbq__back" onClick={onBack} aria-label={t("common.back")} disabled={backDisabled}>
        <BackChevronIcon />
      </button>

      <div
        className={`onbq__progress${pct === 100 ? " is-complete" : ""}`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("onboarding.progressA11y")}
      >
        <div
          className="onbq__progress-fill"
          style={{ width: `calc((100% - 4px) * ${pct / 100})` }}
        />
      </div>

      {children}
    </div>
  );
}

/**
 * One answer row — Figma "Component 6/10/…" (I40:6932): 285x53, r8, 16px
 * padding, an 8px gap between the Body 4 label and its Caption 4 pill. The
 * selected row swaps to a hairline brand border over a 5% brand tint.
 */
export function OnboardingOption({
  label,
  badge,
  recommended = false,
  selected,
  onSelect,
  a11y,
}: {
  label: string;
  /** Optional trailing pill (the goal/grade screens); omitted on AUR-003. */
  badge?: string;
  /** Renders the pill in the teal "추천 / Best" treatment. */
  recommended?: boolean;
  selected: boolean;
  onSelect: () => void;
  a11y: string;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`onbq__answer${selected ? " is-selected" : ""}`}
      role="radio"
      aria-checked={selected}
      aria-label={a11y}
      onClick={onSelect}
    >
      <span className="onbq__answer-label">{label}</span>
      {badge !== undefined && (
        <span className={`onbq__badge${recommended ? " onbq__badge--rec" : ""}`}>
          {recommended && (
            <>
              <span className="onbq__badge-hl">{t("onboarding.recommendedPill")}</span>{" "}
            </>
          )}
          {badge}
        </span>
      )}
    </button>
  );
}
