import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../i18n";
import type { Course, SeriesSummary } from "../../lib/types";

/**
 * COU-001's series card (2658:26081…): the series' own key art with the Free
 * badge, opening its lesson list (COU-002). The progress marker sits in the
 * badge slot the design gives the level, since series carry no level.
 */
function SeriesCard({ series, isPremium }: { series: SeriesSummary; isPremium: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const showFree = !isPremium && series.has_free_lesson;
  const done = series.lesson_count > 0 && series.completed_lesson_count >= series.lesson_count;
  const marker = done ? t("courses.done") : series.started ? t("courses.resume") : null;
  return (
    <button
      className="lechome__card"
      onClick={() => nav(`/series/${series.series_id}`)}
      aria-label={`${series.title}${marker ? `, ${marker}` : ""}${showFree ? t("courses.freeSuffix") : ""}`}
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
        {marker && <span className="lechome__level" aria-hidden="true">{marker}</span>}
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
