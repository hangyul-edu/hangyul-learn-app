import { useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { learnApi } from "../api/endpoints";
import type { Lecture, SeriesDetail } from "../lib/types";
import coursePlay from "../assets/brand/course-play.svg";
import courseMic from "../assets/brand/course-mic.png";
import courseNotebook from "../assets/brand/course-notebook.svg";
import { RewardModal } from "../components/ReviewRewardModal";
import type { CourseRewardState } from "./Lecture";
import icCheck from "../assets/brand/ic-16-check.svg";

/** mm:ss — COU-002 prints every lesson's length as a zero-padded clock. */
function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// The lecture tab (LectureHome) is the catalog browser; this file holds the
// series screen (/series/:seriesId) and the old course link's redirect.

/**
 * Series lesson list — Figma COU-002_강의 선택 (2414:27684 / EN 2397:26192).
 *
 * A full-bleed 375x249 cover with the 242x46 "바로 학습하기" straddling its
 * bottom edge, then 77-tall lesson rows on an 87 pitch: a 70px thumbnail
 * carrying the Free chip and the play glyph, the title + length, a completion
 * chip and the speaking-practice mic.
 */
function LessonRow({ lesson, onOpen, onPractice }: { lesson: Lecture; onOpen: () => void; onPractice: () => void }) {
  const { t } = useTranslation();
  const topik = lesson.track_id === "track_topik";
  return (
    <li className="cdet__row">
      <button className="cdet__thumb" onClick={onOpen} aria-label={lesson.title}>
        {lesson.thumbnail_url && <img className="cdet__thumb-img" src={lesson.thumbnail_url} alt="" />}
        {lesson.access === "free" && <span className="cdet__free">Free</span>}
        <img className="cdet__play" src={coursePlay} alt="" aria-hidden="true" />
      </button>
      <button className="cdet__main" onClick={onOpen}>
        <span className="cdet__title">{lesson.title}</span>
        <span className="cdet__dur">{fmtDur(lesson.duration_seconds)}</span>
      </button>
      <span className={`cdet__status ${lesson.completed ? "is-done" : ""}`}>
        {lesson.completed && <img className="cdet__status-check" src={icCheck} alt="" aria-hidden="true" />}
        {t(lesson.completed ? "courses.doneChip" : "courses.notDone")}
      </span>
      {/* 442:10229 — the mic opens the repeat-after-me practice (COU-014); a
          TOPIK lecture carries the notebook, which opens the question practice
          (COU-003 → COU-017). */}
      {topik ? (
        <button className="cdet__note" onClick={onPractice} aria-label={t("courses.topikPracticeA11y", { title: lesson.title })}>
          <img src={courseNotebook} alt="" aria-hidden="true" />
        </button>
      ) : (
        <button className="cdet__mic" onClick={onPractice} aria-label={t("courses.practiceA11y", { title: lesson.title })}>
          <img src={courseMic} alt="" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/**
 * The old course link (/courses/:courseId, e.g. from a notification or a
 * marketing URL). A course is now a group of series, so it opens the
 * course's first series; with none it falls back to the Classes tab.
 */
export function CourseRedirect() {
  const { courseId = "" } = useParams();
  const q = useQuery({ queryKey: ["course", courseId], queryFn: () => learnApi.course(courseId), retry: false });
  if (q.isLoading) return <div className="screen cdet" aria-busy="true" />;
  const first = q.data?.series?.[0];
  return <Navigate to={first ? `/series/${first.series_id}` : "/courses"} replace />;
}

export function SeriesPage() {
  const { t } = useTranslation();
  const { seriesId = "" } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  // Never stale, so it refetches on every visit: coming back from a lesson
  // must move 바로 학습하기 to where the learner just stopped.
  const q = useQuery({ queryKey: ["series", seriesId], queryFn: () => learnApi.series(seriesId), staleTime: 0 });
  // COU-021: the player hands back the points a just-finished lecture paid.
  const [reward, setReward] = useState(() => (location.state as CourseRewardState | null)?.rewardPoints ?? 0);

  function closeReward() {
    setReward(0);
    // Drop the state so a refresh or back-navigation does not pay out twice on screen.
    nav(location.pathname, { replace: true, state: null });
  }

  return (
    <div className="screen cdet">
      <header className="cdet__nav">
        <button className="cdet__back" onClick={() => nav(-1)} aria-label={t("common.back")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" stroke="#262c31" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </header>

      <div className="screen__body screen__body--nav cdet__body">
        <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} skeleton={<SkeletonList rows={4} />}>
          {(s: SeriesDetail) => {
            const lessons = s.lessons;
            // "바로 학습하기": the lesson of this series the learner watched
            // most recently, which the player opens at the position they left
            // it (its saved playback); 1-1 from the start the first time.
            const resume = s.resume;
            return (
              <>
                <div className="cdet__hero">
                  {s.thumbnail_url && <img className="cdet__hero-img" src={s.thumbnail_url} alt={s.title} />}
                  {resume && (
                    <button className="cdet__cta" onClick={() => nav(`/lectures/${resume.lecture_id}`)}>
                      {t("courses.startNow")}
                    </button>
                  )}
                </div>

                <ul className="cdet__list" role="list" aria-label={s.title}>
                  {lessons.map((l) => (
                    <LessonRow
                      key={l.lecture_id}
                      lesson={l}
                      onOpen={() => nav(`/lectures/${l.lecture_id}`)}
                      onPractice={() =>
                        nav(`/lectures/${l.lecture_id}/${l.track_id === "track_topik" ? "practice" : "speak"}`)
                      }
                    />
                  ))}
                </ul>
              </>
            );
          }}
        </Async>
      </div>

      {reward > 0 && (
        <RewardModal
          points={reward}
          title={t("courses.rewardTitle")}
          subtitle={t("courses.rewardText")}
          pointsA11y={t("courses.rewardA11y", { points: reward })}
          confirmLabel={t("courses.rewardConfirm")}
          closeA11y={t("courses.rewardClose")}
          onConfirm={closeReward}
        />
      )}
    </div>
  );
}
