import { useTranslation } from "../i18n";
import tabIcSpeakingSelected from "../assets/brand/tab-ic-speaking-selected.svg";
import tabIcSpeakingUnselected from "../assets/brand/tab-ic-speaking-unselected.svg";
import tabIcPencil from "../assets/brand/tab-ic-pencil.svg";
import tabIcGear from "../assets/brand/tab-ic-gear.svg";
import type { DashboardTrack } from "../lib/types";

/* The learning-mode tabs and the track card, shared verbatim by Home (MAI-002)
 * and Personalized (TAL-001). Both screens read the same ["dashboard"] query,
 * so keeping one implementation is what keeps them identical — they previously
 * carried two copies whose gauges had drifted to different stroke weights. */

/**
 * Open horseshoe gauge with the percentage centered (yellow when complete).
 *
 * Geometry copied verbatim from Figma "Ellipse 961" (1870:24616): a r=51.19
 * arc running clockwise from 137.15° to 42.85° (265.7° of sweep) with a 7.761
 * round stroke. The viewBox is the arc's centreline box (102.38 x 86, the size
 * Figma reports for the node) and the stroke is allowed to spill outside it,
 * which is how Figma lays it out. The track is white at 80% over the card's
 * peach gradient — not an opaque cream — with a soft grey drop shadow.
 *
 * Drawn in code rather than dropped in as the exported asset because the fill
 * length is driven by the daily-goal ratio.
 */
const GAUGE_ARC =
  "M19.9856 92.3289C11.5106 83.1949 6.3289 70.9623 6.3289 57.5194C6.3289 29.2477 29.2477 6.3289 57.5194 6.3289C85.7911 6.3289 108.71 29.2477 108.71 57.5194C108.71 70.9623 103.528 83.1949 95.0532 92.3289";
const GAUGE_LEN = 237.4; // 51.1905 * 265.7° in radians

function Gauge({ ratio, done }: { ratio: number; done: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const arcColor = done ? "#ffc41f" : "#ff6700";
  const filled = (pct / 100) * GAUGE_LEN;
  return (
    <div className="home__gauge">
      <svg viewBox="6.3289 6.3289 102.3822 86" aria-hidden="true">
        <path
          className="home__gauge-track"
          d={GAUGE_ARC}
          fill="none"
          stroke="#fff"
          strokeOpacity="0.8"
          strokeWidth="7.76103"
          strokeLinecap="round"
        />
        {pct > 0 && (
          <path d={GAUGE_ARC} fill="none" stroke={arcColor} strokeWidth="7.76103" strokeLinecap="round" strokeDasharray={`${filled} ${GAUGE_LEN}`} />
        )}
      </svg>
      <div className="home__gauge-val">
        <span className="home__gauge-num">{pct}</span>
        <span className="home__gauge-pct">%</span>
      </div>
    </div>
  );
}

/** TAL-001/002 bake each tab's glyph into the 96x50 tab space, so the exported
 *  art carries its own placement — the pencil is Figma's `Group 1410118322`.
 *
 *  Conversation (Figma's `Group 1410118340`) is the one glyph that changes with
 *  selection, and in two ways at once. Selected it sits on a white tab with
 *  #FF5A00 strokes (TAL-001 1870:24617 / 1870:25401); unselected it sits on the
 *  #FFA662 tab with WHITE strokes, and shifts 5px left — x=30 rather than 35 —
 *  because the next tab laps over its right edge, so its visible centre moves
 *  (TAL-002 1827:24613 / 1870:25579). Both variants are the identical export
 *  with only those two changes; the KO and EN frames agree exactly.
 *
 *  The pencil and gear are deliberately state-independent: their TAL-001 and
 *  TAL-002 exports are identical, so one asset each is correct. */
function trackIcon(category: string, selected: boolean) {
  const src =
    category === "topik"
      ? tabIcPencil
      : selected
        ? tabIcSpeakingSelected
        : tabIcSpeakingUnselected;
  return <img className="home__tab-ic" src={src} alt="" aria-hidden="true" />;
}

/** The card's heading. The server sends a single untranslated `name` ("회화"),
 *  so the display title comes from the track's stable category instead —
 *  MAI-002's English frame reads "Real Conversation". Anything without a known
 *  category still falls back to whatever the server called it. */
export function useTrackTitle() {
  const { t } = useTranslation();
  return (track: DashboardTrack) => {
    if (track.category === "conversation") return t("personalized.conversationTrack");
    if (track.category === "topik") return t("personalized.topikTrack");
    return track.name;
  };
}

export type TrackDashboardProps = {
  tracks: DashboardTrack[];
  active: DashboardTrack;
  tab: number;
  onTab: (i: number) => void;
  onSettings: () => void;
  /** Goal progress, already clamped by the caller. */
  ratio: number;
  current: number;
  target: number;
  done: boolean;
  onStart: () => void;
};

export function TrackDashboard({
  tracks,
  active,
  tab,
  onTab,
  onSettings,
  ratio,
  current,
  target,
  done,
  onStart,
}: TrackDashboardProps) {
  const { t } = useTranslation();
  const trackTitle = useTrackTitle();
  /* The API sends a track-specific, Korean-only goal label ("회화 문장" /
   * "TOPIK 문제" — dashboard/router.py `_GOAL_LABELS`), but all four card
   * frames use one generic label regardless of track: MAI-002 and TAL-002 read
   * "하루 목표" in Korean and "Daily Target" in English for both conversation
   * and TOPIK. So the design's label wins and the server's is not rendered. */
  const goalLabel = t("personalized.dailyGoal");
  const title = trackTitle(active);

  return (
    <>
      <div className="home__tabs" role="tablist" aria-label={t("personalized.learningModes")}>
        {tracks.map((tr, i) => (
          <button
            key={tr.track_id}
            role="tab"
            aria-selected={i === tab}
            aria-label={trackTitle(tr)}
            className={`home__tab ${i === tab ? "is-active" : ""} home__tab--${tr.category}`}
            onClick={() => onTab(i)}
          >
            {trackIcon(tr.category, i === tab)}
          </button>
        ))}
        <button
          className="home__tab home__tab--muted"
          onClick={onSettings}
          aria-label={t("personalized.settings")}
        >
          <img className="home__tab-ic" src={tabIcGear} alt="" aria-hidden="true" />
        </button>
      </div>

      <section className={`home__hero ${done ? "is-done" : ""}`} aria-label={t("home.trackStatus", { name: title })}>
        {done && (
          <div className="home__hero-goaldone" role="status">
            {t("personalized.goalAchieved")}
          </div>
        )}
        <div className="home__hero-top">
          <div className="home__hero-info">
            <h2 className="home__hero-title">{title}</h2>
            <div className="home__hero-level">
              {active.category === "topik" ? t("personalized.grade", { n: active.level }) : `Lv.${active.level}`}
            </div>
            <div
              className="home__hero-goal"
              aria-label={t("home.goalProgress", {
                label: goalLabel,
                target,
                current,
                percent: Math.min(100, Math.round(ratio * 100)),
              })}
            >
              <span className="home__hero-goal-label">{goalLabel}</span>
              <span className="home__hero-goal-frac">
                {current}/{target}
              </span>
            </div>
          </div>
          <Gauge ratio={ratio} done={done} />
        </div>
        <button className="home__hero-cta" onClick={onStart}>
          {/* The completed card keeps the same CTA as the in-progress one:
              1825:28960 reads "Continue learning" and its Korean twin
              1825:26963 "이어서 학습하기". Only the label was state-dependent —
              onStart is the same action either way — so `done` no longer
              swaps in the Extra Practice wording. */}
          {t(done || current > 0 ? "personalized.continueLearning" : "personalized.startNow")}
        </button>
      </section>
    </>
  );
}
