import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supportApi } from "../api/endpoints";
import { useNoticesCopy } from "../lib/noticeCopy";
import { formatNoticeListDate } from "../lib/format";
import { errorMessage } from "../lib/http";
import { ErrorState, SkeletonList } from "../components/ui/states";
import type { NoticeSummary } from "../lib/types";
import { DetailHeader } from "../components/DetailHeader";
import noticeNewBadge from "../assets/brand/ic-notice-new.svg";

/** Remembers the list scroll offset per language so returning from a detail
 * restores it. Module-scoped so it survives the screen unmounting. */
const scrollByLang = new Map<string, number>();

function dedupe(pages: { items: NoticeSummary[] }[] | undefined): NoticeSummary[] {
  const seen = new Set<string>();
  const out: NoticeSummary[] = [];
  for (const page of pages ?? []) {
    for (const n of page.items) {
      if (seen.has(n.notice_id)) continue; // preserve server order, drop dupes
      seen.add(n.notice_id);
      out.push(n);
    }
  }
  return out;
}

export function NoticeList() {
  const nav = useNavigate();
  const loc = useLocation();
  // Notice bodies are server-localized, so the request language must be the
  // language the chrome is rendering in — that is the i18n layer's, which the
  // profile only seeds.
  const { language: lang } = useTranslation();
  const copy = useNoticesCopy();
  const scrollRef = useRef<HTMLDivElement>(null);

  const list = useInfiniteQuery({
    queryKey: ["notices", lang],
    queryFn: ({ pageParam }) => supportApi.notices({ cursor: pageParam, lang }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = useMemo(() => dedupe(list.data?.pages), [list.data]);

  // Scroll preservation across the detail round-trip.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => scrollByLang.set(lang, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [lang]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || list.data === undefined) return;
    const saved = scrollByLang.get(lang);
    if (saved != null) el.scrollTop = saved;
  }, [lang, list.data]);

  // Load the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !list.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !list.isFetchingNextPage) list.fetchNextPage();
      },
      { rootMargin: "280px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [list.hasNextPage, list.isFetchingNextPage, list.fetchNextPage, list]);

  // No in-app history (deep link / refresh) → fall back to More rather than
  // popping out of the app.
  const goBack = useCallback(() => {
    if (loc.key === "default") nav("/profile");
    else nav(-1);
  }, [loc.key, nav]);

  const openDetail = (noticeId: string) => nav(`/more/notices/${encodeURIComponent(noticeId)}`);

  const initialLoading = list.isLoading;
  const initialError = list.isError && list.data === undefined;

  return (
    <div className="ntc">
      <DetailHeader title={copy.title} onBack={goBack} backLabel={copy.back} />

      <div className="ntc__scroll" ref={scrollRef}>
        {initialLoading ? (
          <div className="ntc__skeleton">
            <SkeletonList rows={7} height={64} />
          </div>
        ) : initialError ? (
          <div className="ntc__state">
            <ErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          </div>
        ) : list.isSuccess && items.length === 0 ? (
          // Successful, genuinely-empty response (no cached items): a quiet,
          // centered message — no icon, card, or CTA. Static text, not an alert.
          <div className="ntc__empty">
            <p className="ntc__empty-text">{copy.empty}</p>
          </div>
        ) : (
          <ul className="ntc__list">
            {items.map((n) => (
              <li key={n.notice_id}>
                <button
                  type="button"
                  className={`ntc__row ${n.is_new ? "ntc__row--new" : ""}`}
                  onClick={() => openDetail(n.notice_id)}
                >
                  <span className="ntc__row-titlerow">
                    <span className="ntc__row-title">{n.title}</span>
                    {/* Group 7189 — a 14px disc whose "N" is a stroked path, not
                        a text glyph, so it comes from the export. */}
                    {n.is_new && (
                      <img className="ntc__badge" src={noticeNewBadge} alt="" role="img" aria-label={copy.newBadgeLabel} />
                    )}
                  </span>
                  <span className="ntc__row-date">{formatNoticeListDate(n.published_at)}</span>
                </button>
              </li>
            ))}

            {/* Pagination footer: non-blocking loader / retry, keeps rows visible. */}
            <li className="ntc__footer" ref={sentinelRef}>
              {list.isFetchingNextPage ? (
                <div className="ntc__footer-loader">
                  <SkeletonList rows={2} height={64} />
                </div>
              ) : list.isFetchNextPageError ? (
                <button className="ntc__footer-retry" onClick={() => list.fetchNextPage()}>
                  {copy.retry}
                </button>
              ) : null}
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

