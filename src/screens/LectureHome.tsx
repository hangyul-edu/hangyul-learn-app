import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { SkeletonList } from "../components/ui/states";
import { ChatbotBottomSheet } from "../components/ChatbotBottomSheet";
import chatbotFab from "../assets/brand/chatbot-fab.svg";
import { bannerApi, learnApi } from "../api/endpoints";
import type { Banner, Course, SeriesSummary } from "../lib/types";
import { croppedImageStyle } from "../lib/imageCrop";
import { useDashboard } from "../api/queries";

// The Classes tab (COU-001) shows the FULL catalog — every course, each with
// its series, conversation and TOPIK together, with an optional track filter
// chip. Nothing carries a level, so nothing is pre-filtered by the user's
// learning level.
type TrackFilter = "all" | "track_conversation" | "track_topik";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const ROTATE_MS = 5000;
const SETTLE_MS = 150;

/* --------------------------- Banner carousel --------------------------- */
/** The in-app path a banner opens, or null. Only in-app paths are followed:
 *  anything else (an external URL, a protocol-relative "//host") leaves the
 *  banner a plain picture rather than a button that does nothing. */
function bannerPath(b: Banner): string | null {
  const url = b.action_url;
  return url && url.startsWith("/") && !/^\/[/\\]/.test(url) ? url : null;
}

function BannerCarousel() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["banners"], queryFn: bannerApi.list, staleTime: 60_000 });
  const banners: Banner[] = q.data?.banners ?? [];
  const count = banners.length;
  const trackRef = useRef<HTMLDivElement>(null);
  // The slide on show is the carousel's source of truth; the scroll position
  // follows it. Reading it back from scrollLeft is what let the band break:
  // a width change (the phone rotated while the lesson played, the address
  // bar resized the column) or a scroll cut short left scrollLeft between two
  // slides, iOS Safari does not always re-snap it, and every later step was computed from
  // that off-grid offset — two half cards showing, dots on the wrong banner.
  const idxRef = useRef(0);
  const [idx, setIdx] = useState(0);
  const heldRef = useRef(false); // a finger or mouse button is on the band
  const restUntilRef = useRef(0); // no auto-step before this (after a swipe)
  const settleRef = useRef<number | undefined>(undefined);

  const show = useCallback((i: number, behavior: ScrollBehavior = "auto") => {
    idxRef.current = i;
    setIdx(i);
    const el = trackRef.current;
    const w = el?.clientWidth ?? 0;
    if (!el || w === 0) return; // not laid out (hidden): realigned on return
    if (Math.abs(el.scrollLeft - i * w) > 0.5) el.scrollTo({ left: i * w, behavior });
  }, []);

  // Put the band back on its slide whenever the slide width may have changed
  // under it or the page comes back into view.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || count === 0) return;
    const realign = () => show(Math.min(idxRef.current, count - 1));
    realign();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(realign);
    ro?.observe(el);
    const onVisible = () => !document.hidden && realign();
    window.addEventListener("resize", realign);
    window.addEventListener("pageshow", realign);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", realign);
      window.removeEventListener("pageshow", realign);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(settleRef.current);
      settleRef.current = undefined;
    };
  }, [count, show]);

  // Auto-rotation: one slide every 5s, looping; held while the band is touched,
  // scrolling, just swiped, hidden, or under reduced motion.
  useEffect(() => {
    if (count < 2 || prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      if (heldRef.current || settleRef.current !== undefined || document.hidden) return;
      if (Date.now() < restUntilRef.current) return;
      show((idxRef.current + 1) % count, "smooth");
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [count, show]);

  function nearest(el: HTMLDivElement) {
    return Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)));
  }
  // Once scrolling stops, adopt the slide it stopped on and snap exactly onto
  // it, so the band can never rest between two banners.
  function settle() {
    settleRef.current = undefined;
    const el = trackRef.current;
    if (!el || el.clientWidth === 0 || heldRef.current) return;
    show(nearest(el));
  }
  function onScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setIdx(nearest(el)); // the dots follow the finger
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(settle, SETTLE_MS);
  }
  function hold() {
    heldRef.current = true;
  }
  function release() {
    if (!heldRef.current) return;
    heldRef.current = false;
    restUntilRef.current = Date.now() + ROTATE_MS;
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(settle, SETTLE_MS);
  }
  function open(b: Banner) {
    const to = bannerPath(b);
    if (to) nav(to);
  }

  // Independent banner state: loading → skeleton; error → hide (never the empty
  // copy); success with no displayable banners → the calm empty region (which
  // keeps the banner slot's height so the page below doesn't shift). Only a
  // populated success renders the carousel — so no auto-slide timer, dots, swipe
  // handlers, or image elements exist when the list is empty.
  if (q.isLoading) return <div className="lechome__banner-skeleton" aria-hidden="true" />;
  if (q.isError) return null;
  if (banners.length === 0)
    return (
      <div className="lechome__banner-empty">
        <p className="lechome__banner-empty-text">{t("courses.noBanners")}</p>
      </div>
    );

  return (
    <section className="lechome__carousel" aria-roledescription="carousel" aria-label={t("courses.bannerAria")}>
      <div
        className="lechome__banners"
        ref={trackRef}
        onScroll={onScroll}
        // Touch is tracked with touch events: a pan fires pointercancel while
        // the finger is still down.
        onTouchStart={hold}
        onTouchEnd={release}
        onTouchCancel={release}
        onPointerDown={(e) => e.pointerType === "mouse" && hold()}
        onPointerUp={(e) => e.pointerType === "mouse" && release()}
        onPointerLeave={(e) => e.pointerType === "mouse" && release()}
        onWheel={() => (restUntilRef.current = Date.now() + ROTATE_MS)}
      >
        {/* Each slide is exactly one screen wide and holds one 335px card with
            20px either side (2658:26022), so a single banner shows at a time
            and its neighbours stay fully off-screen until swiped in. */}
        {banners.map((b, i) => {
          const link = !!bannerPath(b);
          return (
          <div key={b.banner_id} className="lechome__slide">
            <div
              className={`lechome__banner ${link ? "is-link" : ""}`}
              role={link ? "button" : "img"}
              tabIndex={link ? 0 : -1}
              aria-label={t("courses.bannerItemA11y", { alt: b.alt_text, i: i + 1, total: banners.length })}
              onClick={() => open(b)}
              onKeyDown={(e) => {
                if (!link || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault(); // Space would scroll the page
                open(b);
              }}
            >
              {/* The part of the image the admin chose; without one, the
                  image is cover-cropped around its centre. */}
              <img
                className="lechome__banner-img"
                src={b.image_url}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                style={b.image_crop ? croppedImageStyle(b.image_crop) : undefined}
                onError={(e) => (e.currentTarget.style.visibility = "hidden")}
              />
            </div>
          </div>
          );
        })}
      </div>
      {banners.length > 1 && (
        <div className="lechome__dots" aria-hidden="true">
          {banners.map((b, i) => (
            <span key={b.banner_id} className={`lechome__dot ${i === idx ? "is-active" : ""}`} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------ Series card ----------------------------- */
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

/* --------------------------- Course section ---------------------------- */
/**
 * One course (2658:26134 "Speak Korean Instantly"): its title, then its
 * series as a horizontally scrolling row of cards.
 */
function CourseSection({ course, isPremium }: { course: Course; isPremium: boolean }) {
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

/* ------------------------------ Screen --------------------------------- */
export function LectureHome() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
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
          <button
            className="plearn__streak lechome__streak"
            onClick={() => nav("/streak")}
            aria-label={
              streak != null
                ? t("courses.streakCalendarA11y", { days: streak })
                : t("courses.streakCalendarPlainA11y")
            }
          >
            <DailyLearningSun size={14} />
            <span>{streak ?? "-"}</span>
          </button>
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
      <button className="plearn__fab" onClick={() => setChatOpen(true)} aria-label={t("courses.chatbotA11y")}>
        <img className="plearn__fab-art" src={chatbotFab} alt="" aria-hidden="true" />
      </button>

      <ChatbotBottomSheet open={chatOpen} source="lecture" onClose={() => setChatOpen(false)} />
    </div>
  );
}
