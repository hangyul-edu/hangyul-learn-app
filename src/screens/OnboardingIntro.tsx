import { useTranslation } from "../i18n";
import { CitrusOutline } from "../components/brand/AuthBrand";
import introArt from "../assets/brand/onb-intro-art.svg";

/**
 * Onboarding introduction — Figma AUR-001 (KO 36:6696, EN 784:53477). Shown
 * before the questions; the primary button just transitions the parent
 * Onboarding screen into its question flow (no answer submit, no completion).
 *
 * The frame is a fixed 375x812 canvas with a 44px status bar the web app does
 * not draw, so every position below is `figma-y − 44` expressed as a percentage
 * of the 375x768 body (the same convention the splash screen uses):
 *
 *   title      36:6798 — Heading 5 (Bold 24 / 33.6), centred, top 178
 *   desc       36:6797 — Body 2 (SemiBold 16 / 1.435, -0.16), centred, top 217
 *   shadow     Ellipse 936 — solid #66CCCC, 72x28, centred, top 432
 *   art        Group 1410118487 — 293.43x182 at (46, 299), exported whole
 *   msg        36:6796 — Body 9 (Medium 14 / 21.5), 358 wide, top 515
 *   cta        cp_tab's cp_C_01_primaryBtn — 20px gutters, 49 tall, 39 up
 *
 * The four dashed citrus sketches are the shared AME-003 exports placed by
 * their Figma bounding-box centres and rotated as the frame rotates them.
 * `Ellipse 876/868/879/881/878` (five small white dots) are omitted: they sit
 * *behind* the illustration group in the frame, so they never render.
 */
export function OnboardingIntro({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="screen onbi">
      {/* Decorative citrus outlines — non-interactive, clipped by the edges. */}
      <div className="onbi__decor" aria-hidden="true">
        <CitrusOutline className="onbi__citrus onbi__citrus--tr" size={67.91} height={66.85} variant={2} />
        <CitrusOutline className="onbi__citrus onbi__citrus--ml" size={80.09} height={78.86} variant={3} />
        <CitrusOutline className="onbi__citrus onbi__citrus--bl" size={52.45} height={51.58} variant={1} />
        <CitrusOutline className="onbi__citrus onbi__citrus--br" size={85.09} height={83.87} variant={4} />
      </div>

      <h1 className="onbi__title">{t("onboarding.introTitle")}</h1>
      <p className="onbi__desc">
        {t("onboarding.introLine1")}
        <br />
        {t("onboarding.introLine2")}
      </p>

      <span className="onbi__shadow" aria-hidden="true" />
      <img
        className="onbi__art"
        src={introArt}
        role="img"
        aria-label={t("onboarding.introArtA11y")}
      />

      <p className="onbi__msg">
        {t("onboarding.introLine3")}
        <br />
        {t("onboarding.introLine4")}
      </p>

      <button type="button" className="onbi__cta" onClick={onStart}>
        {t("onboarding.startNow")}
      </button>
    </div>
  );
}
