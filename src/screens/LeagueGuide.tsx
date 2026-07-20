import { useEffect, useRef, useState } from "react";
import {
  LEAGUE_INTRO_LINES,
  LEAGUE_POINT_RULES,
  LEAGUE_PROMOTION,
  LEAGUE_SCHEDULE,
  LEAGUE_TIERS,
  LEAGUE_TIER_NOTES,
  tierName,
} from "../lib/league";
import { CitrusBadge, GuideBanner, RewardIcon } from "../components/brand/LeagueGuideArt";

/**
 * Regular League guide, presented as a native bottom-up sheet (slide from the
 * bottom, rounded top, dimmed non-interactive background). Reuses the app's
 * `sheet-up` slide convention; content scrolls as one vertical surface.
 */
export function LeagueGuideSheet({ onClose }: { onClose: () => void }) {
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
        aria-label="정규 리그 안내"
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => {
          if (closing) finishClose();
        }}
      >
        <div className="lgg__scroll">
          {/* Hero */}
          <section className="lgg__hero">
            <button className="lgg__close" onClick={requestClose} aria-label="정규 리그 안내 닫기">
              <svg width="29" height="29" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="lgg__hero-text">
              <h1 className="lgg__title">정규 리그</h1>
              <p className="lgg__desc">
                {LEAGUE_INTRO_LINES.map((line, i) => (
                  <span key={line}>
                    {i > 0 && <br />}
                    {line}
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
              <div className="lgg__sched-range">{LEAGUE_SCHEDULE.rangeLabel}</div>
              <div className="lgg__sched-note">{LEAGUE_SCHEDULE.announceLabel}</div>
              <div className="lgg__sched-note">{LEAGUE_SCHEDULE.timezoneNote}</div>
            </div>

            {/* Promotion + tier ladder card */}
            <div className="lgg__tiers" aria-label={LEAGUE_PROMOTION.aria}>
              <div className="lgg__tiers-head">{LEAGUE_PROMOTION.headline}</div>
              <div className="lgg__tiers-inner" role="list">
                {LEAGUE_TIERS.map((tier) => (
                  <div className="lgg__tier" role="listitem" key={tier}>
                    <span className="lgg__tier-badge" aria-hidden="true">
                      <CitrusBadge tier={tier} />
                    </span>
                    <span className="lgg__tier-name">{tierName(tier)}</span>
                    <span className="lgg__tier-note">{LEAGUE_TIER_NOTES[tier] ?? " "}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* League point earning section */}
            <div className="lgg__points">
              <div className="lgg__points-title">학습할수록 리그 점수(P)가 올라가요</div>
              <div className="lgg__grid">
                {LEAGUE_POINT_RULES.map((rule) => (
                  <div className="lgg__pt" key={rule.id} aria-label={rule.aria}>
                    <span className="lgg__pt-ring" aria-hidden="true">
                      <span className="lgg__pt-center">
                        <RewardIcon kind={rule.id} />
                      </span>
                    </span>
                    <span className="lgg__pt-label">{rule.label}</span>
                    <span className="lgg__pt-value">{rule.points}</span>
                    <span className="lgg__pt-desc">
                      {rule.details.map((detail, i) => (
                        <span key={detail}>
                          {i > 0 && <br />}
                          {detail}
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
