import { useMemo, useState } from "react";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { SkeletonList } from "../components/ui/states";
import { ChatbotLauncher } from "../components/ChatbotLauncher";
import { StreakChip } from "../components/StreakChip";
import { BannerCarousel } from "./lectureHome/BannerCarousel";
import { CourseSection } from "./lectureHome/CourseSection";
import { learnApi } from "../api/endpoints";
import { useDashboard } from "../api/queries";

// The Classes tab (COU-001) shows the FULL catalog — every course, each with
// its series, conversation and TOPIK together, with an optional track filter
// chip. Nothing carries a level, so nothing is pre-filtered by the user's
// learning level.
type TrackFilter = "all" | "track_conversation" | "track_topik";

/* ------------------------------ Screen --------------------------------- */
export function LectureHome() {
  const { t, language } = useTranslation();
  const [filter, setFilter] = useState<TrackFilter>("all");
  const dash = useDashboard();
  // Premium access is the dashboard's server-computed `paywall_required` — the
  // same live check the lecture player enforces (paid, trial, coupon, and the
  // tester/admin roles).
  const isPremium = dash.data?.paywall_required === false;
  // Until entitlement is known, avoid misleading Free badges — treat as premium
  // (hides Free) rather than falsely tagging paid content as free.
  const entitlementKnown = dash.isSuccess;

  // COU-001: a section per course, each a row of its series. Every lesson
  // sits in a series, so nothing is left out. The track filter is a
  // server-side query param.
  const track = filter === "all" ? undefined : filter;
  const catalog = useQuery({ queryKey: ["courses", filter, language], queryFn: () => learnApi.courses(track, language) });
  const courses = useMemo(
    () => (catalog.data?.items ?? []).filter((course) => (course.series ?? []).length > 0),
    [catalog.data],
  );

  const streak = dash.data?.streak_days;
  const loading = catalog.isLoading;
  const failed = catalog.isError;

  return (
    <div className="screen lechome">
      <div className="lechome__scroll">
        <header className="lechome__header">
          <h1 className="lechome__title">{t("courses.title")}</h1>
          <StreakChip
            className="lechome__streak"
            days={streak}
            label={streak != null ? t("courses.streakCalendarA11y", { days: streak }) : t("courses.streakCalendarPlainA11y")}
          />
        </header>

        <BannerCarousel />

        <div className="lechome__filters" role="tablist" aria-label={t("courses.trackFilter")}>
          {(
            [
              ["all", t("courses.trackAll")],
              ["track_conversation", t("courses.trackConversation")],
              ["track_topik", t("courses.trackTopik")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={`lechome__filter ${filter === value ? "is-active" : ""}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="lechome__sections">
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
          </div>
        ) : failed ? (
          <div className="lechome__err">
            <span>{t("courses.loadError")}</span>
            <button className="lechome__retry" onClick={() => void catalog.refetch()}>
              {t("common.retry")}
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="lechome__course-empty">
            <p className="lechome__course-empty-text">{t("courses.empty")}</p>
          </div>
        ) : (
          <div className="lechome__sections">
            {courses.map((course) => (
              <CourseSection
                key={course.course_id}
                course={course}
                isPremium={entitlementKnown ? isPremium : true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating chatbot button — opens the shared chatbot bottom sheet in
          place (same component as Personalized Learning), not a separate route. */}
      {/* Same exported chatbot button as Practice (Figma 1825:29302). */}
      <ChatbotLauncher source="lecture" label={t("courses.chatbotA11y")} />
    </div>
  );
}
