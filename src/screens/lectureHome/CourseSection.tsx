import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { Course, SeriesLevel, SeriesSummary } from "../../lib/types";

/** The level chip's text: the English word in every app language, as COU-001
 *  draws it (KO 2658:26020 and EN 2407:27217 alike). */
const LEVEL_CHIP: Record<SeriesLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
const LEVEL_A11Y = {
  beginner: "courses.levelBeginner",
  intermediate: "courses.levelIntermediate",
  advanced: "courses.levelAdvanced",
} as const;

/**
 * COU-001's series card (2658:26081…): the series' own key art with the Free
 * badge at the top and the series' level chip (set in the admin) at the
 * bottom, opening its lesson list (COU-002). Progress (resume / done) is not
 * drawn on the card — the design has the level there — and is read out with
 * the card's name instead.
 */
function SeriesCard({ series, isPremium }: { series: SeriesSummary; isPremium: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const showFree = !isPremium && series.has_free_lesson;
  const done = series.lesson_count > 0 && series.completed_lesson_count >= series.lesson_count;
  const marker = done ? t("courses.done") : series.started ? t("courses.resume") : null;
  const level = series.level ? LEVEL_CHIP[series.level] : null;
  const label = [series.title, series.level ? t(LEVEL_A11Y[series.level]) : null, marker]
    .filter(Boolean)
    .join(", ");
  return (
    <button
      className="lechome__card"
      onClick={() => nav(`/series/${series.series_id}`)}
      aria-label={`${label}${showFree ? t("courses.freeSuffix") : ""}`}
    >
      {/* Figma's cards are the key art alone — the series' name is drawn
          into it. The name stays in the button's label, and is printed on
          the placeholder when a series has no art yet. */}
      <div className="lechome__thumb">
        {series.thumbnail_url ? (
          <img className="lechome__thumb-img" src={series.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="lechome__thumb-ph" aria-hidden="true">
            <span className="lechome__thumb-ph-title">{series.title}</span>
          </div>
        )}
        {showFree && <span className="lechome__free" aria-hidden="true">Free</span>}
        {level && <span className="lechome__level" aria-hidden="true">{level}</span>}
      </div>
    </button>
  );
}

/**
 * One course (2658:26134 "Speak Korean Instantly"): its title, then its
 * series as a horizontally scrolling row of cards.
 */
export function CourseSection({ course, isPremium }: { course: Course; isPremium: boolean }) {
  const series = course.series ?? [];
  if (series.length === 0) return null;
  return (
    <section className="lechome__section" aria-label={course.title}>
      <h2 className="lechome__section-title">{course.title}</h2>
      <div className="lechome__row" role="list">
        {series.map((s) => (
          <div role="listitem" key={s.series_id}>
            <SeriesCard series={s} isPremium={isPremium} />
          </div>
        ))}
      </div>
    </section>
  );
}
