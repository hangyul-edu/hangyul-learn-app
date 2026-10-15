import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import {
  LEAGUE_INTRO_LINE_KEYS,
  LEAGUE_POINT_RULES,
  LEAGUE_PROMOTION_KEYS,
  LEAGUE_SCHEDULE_KEYS,
  LEAGUE_TIERS,
  LEAGUE_TIER_NOTE_KEYS,
  tierName,
} from "../lib/league";
import { CitrusBadge, GuideBanner, RewardIcon } from "../components/brand/LeagueGuideArt";
import { CloseIcon } from "../components/brand/Glyphs";

/**
 * Regular League guide, presented as a native bottom-up sheet (slide from the
 * bottom, rounded top, dimmed non-interactive background). Reuses the app's
 * `sheet-up` slide convention; content scrolls as one vertical surface.
 */
export function LeagueGuideSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closedRef = useRef(false);
  const viaPopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    // Balance the history entry we pushed (unless the browser already popped it).
    if (!viaPopRef.current) {
      try {
        if (window.history.state?.lgGuide) window.history.back();
      } catch {
        /* jsdom / restricted history — ignore */
      }
    }
    onClose();
  };

  // Animated dismissal (button / backdrop). Guarded against repeat taps; a
  // timeout backstops environments where animationend never fires (e.g. jsdom).
  const requestClose = () => {
    if (closing || closedRef.current) return;
    setClosing(true);
    timerRef.current = setTimeout(finishClose, 280);
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    // Move screen-reader focus into the sheet. `preventScroll` is essential:
    // during the slide-up the close button is still off-screen, and a scrolling
    // focus would drag the (fixed) background along with it.
    cardRef.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    // Hardware / browser back dismisses the sheet instead of leaving /league.
    window.history.pushState({ lgGuide: true }, "");
    const onPop = () => {
      viaPopRef.current = true;
      finishClose();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("popstate", onPop);
      if (timerRef.current) clearTimeout(timerRef.current);
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`lgg-overlay ${closing ? "is-closing" : ""}`}
      role="presentation"
      onClick={requestClose}
    >
      <div
        className={`lgg ${closing ? "is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={t("league.guideA11y")}
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => {
          if (closing) finishClose();
        }}
      >
        <div className="lgg__scroll">
          {/* Hero */}
          <section className="lgg__hero">
            <button className="lgg__close" onClick={requestClose} aria-label={t("league.guideCloseA11y")}>
              <CloseIcon size={17.5} color="#fff" weight={2.4} />
            </button>
            <div className="lgg__hero-text">
              <h1 className="lgg__title">{t("league.guideTitle")}</h1>
              <p className="lgg__desc">
                {LEAGUE_INTRO_LINE_KEYS.map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {t(line)}
                  </span>
                ))}
              </p>
            </div>
            <div className="lgg__banner" aria-hidden="true">
              <GuideBanner />
            </div>
          </section>

          <div className="lgg__body">
            {/* Weekly schedule card */}
            <div className="lgg__sched">
              <div className="lgg__sched-range">{t(LEAGUE_SCHEDULE_KEYS.rangeLabel)}</div>
              <div className="lgg__sched-note">{t(LEAGUE_SCHEDULE_KEYS.announceLabel)}</div>
              <div className="lgg__sched-note">{t(LEAGUE_SCHEDULE_KEYS.timezoneNote)}</div>
            </div>

            {/* Promotion + tier ladder card */}
            <div className="lgg__tiers" aria-label={t(LEAGUE_PROMOTION_KEYS.aria)}>
              <div className="lgg__tiers-head">{t(LEAGUE_PROMOTION_KEYS.headline)}</div>
              <div className="lgg__tiers-inner" role="list">
                {LEAGUE_TIERS.map((tier) => (
                  <div className="lgg__tier" role="listitem" key={tier}>
                    <span className="lgg__tier-badge" aria-hidden="true">
                      <CitrusBadge tier={tier} />
                    </span>
                    <span className="lgg__tier-name">{tierName(tier)}</span>
                    <span className="lgg__tier-note">{LEAGUE_TIER_NOTE_KEYS[tier] ? t(LEAGUE_TIER_NOTE_KEYS[tier]!) : " "}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* League point earning section */}
            <div className="lgg__points">
              <div className="lgg__points-title">{t("league.pointsTitle")}</div>
              <div className="lgg__grid">
                {LEAGUE_POINT_RULES.map((rule) => (
                  <div className="lgg__pt" key={rule.id} aria-label={t(rule.aria)}>
                    {/* The export already carries the dashed ring and the soft
                        disc, so no wrapper is drawn around it. */}
                    <RewardIcon kind={rule.id} />
                    <span className="lgg__pt-label">{t(rule.label)}</span>
                    <span className="lgg__pt-value">{rule.points}</span>
                    <span className="lgg__pt-desc">
                      {rule.details.map((detail, i) => (
                        <span key={detail}>
                          {i > 0 && <br />}
                          {t(detail)}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
