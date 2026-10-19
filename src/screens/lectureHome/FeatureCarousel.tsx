import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { bannerApi } from "../../api/endpoints";
import { croppedImageStyle } from "../../lib/imageCrop";
import type { Banner } from "../../lib/types";

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

/** COU-001's banner band: one banner a slide, auto-rotating, swipeable. */
export function FeatureCarousel() {
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
  if (q.isLoading) return <div className="lechome__feature-skeleton" aria-hidden="true" />;
  if (q.isError) return null;
  if (banners.length === 0)
    return (
      <div className="lechome__feature-empty">
        <p className="lechome__feature-empty-text">{t("courses.noBanners")}</p>
      </div>
    );

  return (
    <section className="lechome__carousel" aria-roledescription="carousel" aria-label={t("courses.bannerAria")}>
      <div
        className="lechome__features"
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
              className={`lechome__feature ${link ? "is-link" : ""}`}
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
                className="lechome__feature-img"
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
