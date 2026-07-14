import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SunIcon } from "../components/brand/HomeIcons";
import { CharacterArt } from "../components/brand/ProfileAssets";
import { SkeletonList } from "../components/ui/states";
import { bannerApi, dashboardApi, learnApi, subApi } from "../api/endpoints";
import type { Banner, Course, Lecture } from "../lib/types";

type CoursesPage = { items: Course[]; next_cursor: string | null; has_more: boolean };

// Single-arg page fetcher (keeps the useInfiniteQuery generic inference clean).
const fetchCoursesPage = (cursor: string | undefined): Promise<CoursesPage> =>
  learnApi.courses(FEED_TRACK, cursor);

// The Lecture-home vertical feed is the conversation track's courses (the
// reference sections are conversation courses). A dedicated cross-track feed
// could replace this without touching the UI.
const FEED_TRACK = "track_conversation";
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Client-side level → label (backend exposes numeric `level` only). */
function levelLabel(level: number): string {
  if (level >= 7) return "Advanced";
  if (level >= 4) return "Intermediate";
  return "Beginner";
}
function dedupById<T>(items: T[], id: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = id(it);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/* --------------------------- Banner carousel --------------------------- */
function BannerCarousel() {
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

  if (q.isLoading) return <div className="lechome__banner-skeleton" aria-hidden="true" />;
  if (banners.length === 0) return null; // no active banners → hide cleanly

  return (
    <section className="lechome__carousel" aria-roledescription="carousel" aria-label="광고 배너">
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
            aria-label={`${b.alt_text} (배너 ${i + 1}/${banners.length})`}
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
  const nav = useNavigate();
  const showFree = lecture.access === "free" && !isPremium;
  return (
    <button
      className="lechome__card"
      onClick={() => nav(`/lectures/${lecture.lecture_id}`)}
      aria-label={`${lecture.title}, ${levelLabel(lecture.level)}${showFree ? ", 무료 강의" : ""}`}
    >
      <div className="lechome__thumb">
        {lecture.thumbnail_url ? (
          <img className="lechome__thumb-img" src={lecture.thumbnail_url} alt="" loading="lazy" />
        ) : (
          <div className="lechome__thumb-ph" aria-hidden="true" />
        )}
        {showFree && <span className="lechome__free" aria-hidden="true">Free</span>}
        <span className="lechome__level" aria-hidden="true">{levelLabel(lecture.level)}</span>
      </div>
    </button>
  );
}

/* --------------------------- Course section ---------------------------- */
function CourseSection({ course, isPremium }: { course: Course; isPremium: boolean }) {
  // Each section owns its horizontal pagination (state keyed by this course id
  // via the React key on the parent). Seeded from the preview the feed bundled.
  const [extra, setExtra] = useState<Lecture[]>([]);
  const [cursor, setCursor] = useState<string | null>(course.lessons_next_cursor ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const lectures = useMemo(
    () => dedupById([...(course.lessons_preview ?? []), ...extra], (l) => l.lecture_id),
    [course.lessons_preview, extra],
  );

  async function loadMore() {
    if (loading || cursor == null) return;
    setLoading(true);
    setError(false);
    try {
      const page = await learnApi.courseLessons(course.course_id, cursor);
      setExtra((prev) => dedupById([...prev, ...page.items], (l) => l.lecture_id));
      setCursor(page.next_cursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { root: el.closest(".lechome__row"), rootMargin: "0px 200px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loading]);

  if (lectures.length === 0) return null; // omit empty sections

  return (
    <section className="lechome__section" aria-label={course.title}>
      <h2 className="lechome__section-title">{course.title}</h2>
      <div className="lechome__row" role="list">
        {lectures.map((l) => (
          <div role="listitem" key={l.lecture_id}>
            <LectureCard lecture={l} isPremium={isPremium} />
          </div>
        ))}
        {error ? (
          <button className="lechome__row-retry" onClick={() => loadMore()}>다시 불러오기</button>
        ) : cursor != null ? (
          <div className="lechome__row-foot" ref={sentinel}>
            {loading && <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />}
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------ Screen --------------------------------- */
export function LectureHome() {
  const nav = useNavigate();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const sub = useQuery({ queryKey: ["sub-me"], queryFn: subApi.mine });
  // Premium lecture access (paid, trial, or voucher all set is_premium server-side).
  const isPremium = sub.data?.is_premium === true || sub.data?.status === "trial";
  // Until entitlement is known, avoid misleading Free badges — treat as premium
  // (hides Free) rather than falsely tagging paid content as free.
  const entitlementKnown = sub.isSuccess;

  // Vertical course-section pagination (cursor-based). Kept in local state so the
  // isPremium change only recomputes badges — it never reloads the course feed.
  const [sections, setSections] = useState<Course[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [moreState, setMoreState] = useState<"idle" | "loading" | "error" | "done">("idle");
  const bootedRef = useRef(false);
  const loadingMoreRef = useRef(false); // in-flight guard (independent of moreState)

  async function loadFirst() {
    setFeedLoading(true);
    setFeedError(false);
    try {
      const page = await fetchCoursesPage(undefined);
      setSections(dedupById(page.items, (c) => c.course_id));
      setCursor(page.next_cursor ?? undefined);
      setMoreState(page.next_cursor ? "idle" : "done");
    } catch {
      setFeedError(true);
    } finally {
      setFeedLoading(false);
    }
  }
  // Called by the observer (only while "idle") and by the retry button.
  async function loadMore() {
    if (loadingMoreRef.current || cursor == null) return;
    loadingMoreRef.current = true;
    setMoreState("loading");
    try {
      const page = await fetchCoursesPage(cursor);
      setSections((prev) => dedupById([...prev, ...page.items], (c) => c.course_id));
      setCursor(page.next_cursor ?? undefined);
      setMoreState(page.next_cursor ? "idle" : "done");
    } catch {
      setMoreState("error");
    } finally {
      loadingMoreRef.current = false;
    }
  }
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bottomSentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bottomSentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (entries) => {
        // Auto-load only when idle — an errored page waits for the retry button.
        if (entries[0].isIntersecting && moreState === "idle") void loadMore();
      },
      { rootMargin: "320px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreState, cursor]);

  const streak = dash.data?.streak_days;

  return (
    <div className="screen lechome">
      <div className="lechome__scroll">
        <header className="lechome__header">
          <h1 className="lechome__title">강의</h1>
          <button
            className="plearn__streak lechome__streak"
            onClick={() => nav("/streak")}
            aria-label={streak != null ? `연속 학습 ${streak}일, 달력 열기` : "연속 학습, 달력 열기"}
          >
            <SunIcon size={22} />
            <span>{streak ?? "-"}</span>
          </button>
        </header>

        <BannerCarousel />

        {feedLoading ? (
          <div className="lechome__sections">
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
            <div className="lechome__section-title lechome__skel-title" aria-hidden="true" />
            <SkeletonList rows={1} height={130} />
          </div>
        ) : feedError ? (
          <div className="lechome__err">
            <span>강의를 불러오지 못했어요.</span>
            <button className="lechome__retry" onClick={() => loadFirst()}>다시 시도</button>
          </div>
        ) : sections.length === 0 ? (
          <p className="lechome__empty">아직 강의가 없어요. 곧 새로운 강의가 추가돼요.</p>
        ) : (
          <div className="lechome__sections">
            {sections.map((c) => (
              <CourseSection key={c.course_id} course={c} isPremium={entitlementKnown ? isPremium : true} />
            ))}
            <div className="lechome__foot" ref={bottomSentinel}>
              {moreState === "loading" ? (
                <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} />
              ) : moreState === "error" ? (
                <button className="lechome__retry" onClick={() => { setMoreState("idle"); void loadMore(); }}>다시 불러오기</button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Floating chatbot button (reused) */}
      <button className="plearn__fab" onClick={() => nav("/ai")} aria-label="AI 챗봇과 자유롭게 대화하기">
        <span className="plearn__fab-face">
          <CharacterArt variant="AVATAR_01" fill="100%" />
        </span>
      </button>
    </div>
  );
}
