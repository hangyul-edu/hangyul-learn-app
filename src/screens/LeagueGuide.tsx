import { useEffect, useRef, useState } from "react";
import { LEAGUE_POINT_RULES, LEAGUE_PROMOTION, LEAGUE_SCHEDULE } from "../lib/league";
import { CrossedSwords, GuideBanner, RewardIcon, ScheduleMedal } from "../components/brand/LeagueGuideArt";

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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="lgg__hero-text">
              <h1 className="lgg__title">정규 리그</h1>
              <p className="lgg__desc">
                학습 점수로 경쟁하는 리그예요.
                <br />
                공부할수록 점수와 순위가 올라가요
              </p>
            </div>
            <div className="lgg__banner" aria-hidden="true">
              <GuideBanner />
            </div>
          </section>

          <div className="lgg__body">
            {/* Schedule card */}
            <div className="lgg__sched">
              <span className="lgg__sched-icon" aria-hidden="true">
                <ScheduleMedal />
              </span>
              <div className="lgg__sched-text">
                <div className="lgg__sched-main">
                  {LEAGUE_SCHEDULE.startLabel}
                  <br />
                  {LEAGUE_SCHEDULE.endLabel}
                </div>
                <div className="lgg__sched-sub">{LEAGUE_SCHEDULE.announceLabel}</div>
              </div>
            </div>

            {/* Point explanation panel */}
            <div className="lgg__panel">
              <div className="lgg__panel-head">학습할수록 리그 점수(P)가 올라가요</div>
              <div className="lgg__grid">
                {LEAGUE_POINT_RULES.map((rule) => (
                  <div className="lgg__reward" key={rule.id} aria-label={rule.aria}>
                    <span className="lgg__reward-ring" aria-hidden="true">
                      <RewardIcon kind={rule.id} />
                    </span>
                    <span className="lgg__reward-label">{rule.label}</span>
                    <span className="lgg__reward-point">{rule.points}</span>
                    <span className="lgg__reward-detail">
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

            {/* Promotion rule card */}
            <div className="lgg__promo" aria-label={LEAGUE_PROMOTION.aria}>
              <span className="lgg__promo-icon" aria-hidden="true">
                <CrossedSwords />
              </span>
              <div className="lgg__promo-text">
                <div className="lgg__promo-head">{LEAGUE_PROMOTION.headline}</div>
                {LEAGUE_PROMOTION.rules.map((line) => (
                  <div className="lgg__promo-rule" key={line}>
                    {line}
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
