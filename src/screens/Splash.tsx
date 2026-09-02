import { useTranslation } from "../i18n";
import wordmark from "../assets/brand/splash-wordmark.svg";
import letterG from "../assets/brand/splash-letter-g.svg";
import letterN from "../assets/brand/splash-letter-n.svg";
import letterR from "../assets/brand/splash-letter-r.svg";
import letterO from "../assets/brand/splash-letter-o.svg";
import letterB from "../assets/brand/splash-letter-b.svg";
import dots from "../assets/brand/splash-dots.svg";

/**
 * Boot splash — Figma GEN-001_스플래시 (784:53218) / GEN-002 (KO 1:12340,
 * EN 784:53146).
 *
 * Every position below is the Figma frame's own 375x812 geometry, expressed as
 * a percentage so the screen scales with the phone frame:
 *
 *   rings      concentric 968 / 812 / 626 / 414 / 266 circles, Brand color 1
 *              at 5%, centred on the frame
 *   dots       Group 33353, 366x653 at (12, 52)
 *   letters    ㄱ ㄴ ㄹ ㅇ ㅂ scattered around the edges; ㅇ is rotated 15°
 *   wordmark   241.43x54 at (67, 367)
 *   tagline    centred at x=187, top 436 — Body 2, SemiBold 16 / 1.435
 *
 * The rings are the only pieces not taken from an export: they are plain solid
 * circles, so CSS reproduces them exactly and stays resolution-independent.
 */
export function Splash() {
  const { t } = useTranslation();
  /* No .app-frame wrapper here: every route already renders inside AppFrame's,
     and nesting a second one put the splash 25px down and 852 tall inside an
     852-tall parent once the >=620px rules add a 24px margin and a border —
     the whole screen sat low and overflowed. It looked fine only on phone
     widths, where the frame has no margin or border to duplicate. */
  return (
    <div className="splash" role="status" aria-label={t("splash.a11y")}>
        <span className="splash__ring splash__ring--1" aria-hidden="true" />
        <span className="splash__ring splash__ring--2" aria-hidden="true" />
        <span className="splash__ring splash__ring--3" aria-hidden="true" />
        <span className="splash__ring splash__ring--4" aria-hidden="true" />
        <span className="splash__ring splash__ring--5" aria-hidden="true" />

        <img className="splash__dots" src={dots} alt="" aria-hidden="true" />

        <img className="splash__letter splash__letter--g" src={letterG} alt="" aria-hidden="true" />
        <img className="splash__letter splash__letter--r" src={letterR} alt="" aria-hidden="true" />
        <img className="splash__letter splash__letter--b" src={letterB} alt="" aria-hidden="true" />
        <img className="splash__letter splash__letter--o" src={letterO} alt="" aria-hidden="true" />
        <img className="splash__letter splash__letter--n" src={letterN} alt="" aria-hidden="true" />

        <img className="splash__wordmark" src={wordmark} alt="" aria-hidden="true" />
      <p className="splash__tagline">{t("splash.tagline")}</p>
    </div>
  );
}
