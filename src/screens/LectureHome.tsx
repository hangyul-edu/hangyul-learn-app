import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { SkeletonList } from "../components/ui/states";
import { ChatbotBottomSheet } from "../components/ChatbotBottomSheet";
import chatbotFab from "../assets/brand/chatbot-fab.svg";
import { bannerApi, dashboardApi, learnApi, subApi } from "../api/endpoints";
import type { Banner, Lecture } from "../lib/types";

// The lecture page shows the FULL catalog — conversation and TOPIK lectures
// together, with an optional track filter chip. Lectures carry no level, so
// nothing is pre-filtered by the user's learning level.
type TrackFilter = "all" | "track_conversation" | "track_topik";

const TRACK_LABEL_KEYS: Record<string, TranslationKey> = {
  track_conversation: "courses.trackConversation",
  track_topik: "trackSettings.topikTitle",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* --------------------------- Banner carousel --------------------------- */
function BannerCarousel() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["banners"], queryFn: bannerApi.list, staleTime: 60_000 });
  const banners: Banner[] = q.data?.banners ?? [];
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [idx, setIdx] = useState(0);

  // Auto-rotation: advance every 5s, loop, pause while dragging / hidden / reduced-motion.
  useEffect(() => {
    if (banners.length < 2 || prefersReducedMotion()) return;
    const t = window.setInterval(() => {
      const el = trackRef.current;
      if (!el || pausedRef.current || document.hidden) return;
      const w = el.clientWidth || 1;
      const next = (Math.round(el.scrollLeft / w) + 1) % banners.length;
      el.scrollTo({ left: next * w, behavior: "smooth" });
    }, 5000);
    return () => window.clearInterval(t);
  }, [banners.length]);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / (el.clientWidth || 1)));
  }
  function open(b: Banner) {
    if (b.action_url && b.action_url.startsWith("/")) nav(b.action_url);
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
        onPointerDown={() => (pausedRef.current = true)}
        onPointerUp={() => (pausedRef.current = false)}
        onPointerLeave={() => (pausedRef.current = false)}
      >
        {banners.map((b, i) => (
          <div
            key={b.banner_id}
            className={`lechome__banner ${b.action_url ? "is-link" : ""}`}
            role={b.action_url ? "button" : "img"}
            tabIndex={b.action_url ? 0 : -1}
            aria-label={t("courses.bannerItemA11y", { alt: b.alt_text, i: i + 1, total: banners.length })}
            onClick={() => open(b)}
            onKeyDown={(e) => e.key === "Enter" && open(b)}
          >
            <img
              className="lechome__banner-img"
              src={b.image_url}
              alt=""
              loading="lazy"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
          </div>
        ))}
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

/* ----------------------------- Lecture card ---------------------------- */
function LectureCard({ lecture, isPremium }: { lecture: Lecture; isPremium: boolean }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const showFree = lecture.access === "free" && !isPremium;
  const marker = lecture.completed ? t("courses.done") : lecture.started ? t("courses.resume") : null;
  return (
    <button
      className="lechome__card"
      onClick={() => nav(`/lectures/${lecture.lecture_id}`)}
      aria-label={`${lecture.title}${marker ? `, ${marker}` : ""}${showFree ? t("courses.freeSuffix") : ""}`}
    >
      <div className="lechome__thumb">
        {lecture.thumbnail_url ? (
          <img className="lechome__thumb-img" src={lecture.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="lechome__thumb-ph" aria-hidden="true" />
        )}
        {showFree && <span className="lechome__free" aria-hidden="true">Free</span>}
        {marker && <span className="lechome__level" aria-hidden="true">{marker}</span>}
      </div>
      <p className="lechome__card-title">{lecture.title}</p>
    </button>
  );
}

/* --------------------------- Track section ----------------------------- */
function TrackSection({
  trackId,
  lectures,
  isPremium,
}: {
  trackId: string;
  lectures: Lecture[];
  isPremium: boolean;
}) {
  const { t } = useTranslation();
  if (lectures.length === 0) return null;
  const title = t("courses.trackLabel", {
    name: TRACK_LABEL_KEYS[trackId] ? t(TRACK_LABEL_KEYS[trackId]) : trackId,
  });
  return (
    <section className="lechome__section" aria-label={title}>
      <h2 className="lechome__section-title">{title}</h2>
      <div className="lechome__row" role="list">
        {lectures.map((l) => (
          <div role="listitem" key={l.lecture_id}>
            <LectureCard lecture={l} isPremium={isPremium} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Screen --------------------------------- */
export function LectureHome() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [filter, setFilter] = useState<TrackFilter>("all");
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const sub = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  // Premium lecture access (paid, trial, or voucher all set is_premium server-side).
  const isPremium = sub.data?.is_premium === true || sub.data?.status === "trial";
  // Until entitlement is known, avoid misleading Free badges — treat as premium
  // (hides Free) rather than falsely tagging paid content as free.
  const entitlementKnown = sub.isSuccess;

  // One unified catalog fetch; the track filter is a server-side query param.
  const feed = useQuery({
    queryKey: ["lectures", filter],
    queryFn: () => learnApi.lectures(filter === "all" ? undefined : filter),
  });

  const byTrack = useMemo(() => {
    const groups = new Map<string, Lecture[]>();
    for (const lecture of feed.data?.items ?? []) {
      const bucket = groups.get(lecture.track_id) ?? [];
      bucket.push(lecture);
      groups.set(lecture.track_id, bucket);
    }
    return groups;
  }, [feed.data]);

  const streak = dash.data?.streak_days;
  const total = feed.data?.items.length ?? 0;

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

        {feed.isLoading ? (
          <div className="lechome__sections">
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
          </div>
        ) : feed.isError ? (
          <div className="lechome__err">
            <span>{t("courses.loadError")}</span>
            <button className="lechome__retry" onClick={() => feed.refetch()}>{t("common.retry")}</button>
          </div>
        ) : total === 0 ? (
          <div className="lechome__course-empty">
            <p className="lechome__course-empty-text">{t("courses.empty")}</p>
          </div>
        ) : (
          <div className="lechome__sections">
            {[...byTrack.entries()].map(([trackId, lectures]) => (
              <TrackSection
                key={trackId}
                trackId={trackId}
                lectures={lectures}
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
