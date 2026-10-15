import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { CitrusBadge } from "../../components/brand/LeagueGuideArt";
import { LEAGUE_TIERS, TIER_META, tierIndex, type LeagueTier } from "../../lib/league";

/** Official league tier image — colourful citrus for reached tiers, greyed +
 *  padlocked for future ones. */
function LeagueBadge({ tier, reached, current }: { tier: LeagueTier; reached: boolean; current: boolean }) {
  const { t } = useTranslation();
  return (
    <CitrusBadge
      tier={tier}
      locked={!reached}
      className={`lg__badge ${current ? "is-current" : ""}`}
      label={`${t("league.tierLabel", { tier: TIER_META[tier].name })}${
        current ? `, ${t("league.currentLeague")}` : reached ? "" : `, ${t("league.locked")}`
      }`}
    />
  );
}

/**
 * Horizontal ladder of every tier with the user's CURRENT league centered.
 * Reached tiers are colored, future tiers gray + locked. It is a progress
 * visualization, NOT a selector — after any drag/scroll settles it snaps back
 * to re-center the current league, and it never mutates the fixed title/timer.
 */
export function LeagueCarousel({ currentTier }: { currentTier: LeagueTier }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement | null>(null);
  const slotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const curIdx = Math.max(0, tierIndex(currentTier));
  // Which badge is nearest the carousel centre — it scales up ("focused").
  const [focused, setFocused] = useState(curIdx);

  const recenter = (behavior: ScrollBehavior) => {
    const box = scrollRef.current;
    const el = currentRef.current;
    if (!box || !el) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2, behavior });
  };

  // Highlight whichever slot's centre is closest to the viewport centre.
  const updateFocused = () => {
    const box = scrollRef.current;
    if (!box) return;
    const center = box.scrollLeft + box.clientWidth / 2;
    let nearest = 0;
    let best = Infinity;
    slotsRef.current.forEach((el, i) => {
      if (!el) return;
      const distance = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setFocused(nearest);
  };

  // Center the user's current league on mount (no animation — it's the anchor).
  useLayoutEffect(() => {
    recenter("auto");
    updateFocused();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTier]);

  // Recompute focus continuously as the user drags; snap back once it settles.
  const onScroll = () => {
    updateFocused();
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => recenter("smooth"), 350);
  };
  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  return (
    <div
      className="lg__carousel"
      ref={scrollRef}
      onScroll={onScroll}
      onTouchEnd={() => recenter("smooth")}
      onPointerUp={() => recenter("smooth")}
      aria-label={t("league.progressA11y")}
    >
      <div className="lg__carousel-track">
        {LEAGUE_TIERS.map((tier, i) => (
          <div
            key={tier}
            ref={(el) => {
              slotsRef.current[i] = el;
              if (i === curIdx) currentRef.current = el;
            }}
            className={`lg__badge-slot ${i === curIdx ? "is-current" : ""} ${i === focused ? "is-focused" : ""}`}
            aria-current={i === curIdx ? "true" : undefined}
          >
            <LeagueBadge tier={tier} reached={i <= curIdx} current={i === curIdx} />
          </div>
        ))}
      </div>
    </div>
  );
}
