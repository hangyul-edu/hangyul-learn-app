import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supportApi } from "../api/endpoints";
import { FAQ_CATEGORIES, findFaqCategory } from "../lib/faqCategories";
import { errorMessage } from "../lib/http";
import { EmptyState, ErrorState, SkeletonList } from "../components/ui/states";
import { FaqHeader, LoadMoreSentinel, QuestionCard } from "../components/faq/FaqPieces";
import { SupportChatButton } from "../components/faq/SupportChatButton";
import type { Faq as FaqItem } from "../lib/types";
import icSearch from "../assets/brand/ic-24-search.svg";
import icChevron from "../assets/brand/ic-16-chevron-gray.svg";

/** Remembers each list's scroll offset so returning from a detail restores it.
 * Keyed by the URL search string (category / query), which fully identifies a
 * list state. Module-scoped so it survives the screen unmounting on navigation. */
const scrollPositions = new Map<string, number>();

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Flatten paginated FAQ pages, dropping any duplicate ids across pages. */
function dedupe(pages: { items: FaqItem[] }[] | undefined): FaqItem[] {
  const seen = new Set<string>();
  const out: FaqItem[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.faq_id)) continue;
      seen.add(item.faq_id);
      out.push(item);
    }
  }
  return out;
}

export function Faq() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const categorySlug = params.get("category") ?? undefined;
  const category = findFaqCategory(categorySlug);
  const urlQuery = (params.get("q") ?? "").trim();

  const [input, setInput] = useState(params.get("q") ?? "");
  const [focused, setFocused] = useState(false);
  const debounced = useDebouncedValue(input.trim(), 300);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reflect the debounced search box into the URL. Entering search mode pushes
  // a history entry (so Back leaves search); edits within search — and clearing
  // it — replace, to avoid history spam and navigation loops.
  useEffect(() => {
    const current = (params.get("q") ?? "").trim();
    if (debounced === current) return;
    const next = new URLSearchParams(params);
    if (debounced) next.set("q", debounced);
    else next.delete("q");
    const enteringSearch = !!debounced && !current;
    setParams(next, { replace: !enteringSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const mode: "landing" | "category" | "search" = urlQuery ? "search" : category ? "category" : "landing";

  // `language` is part of every key: the server returns different text — and
  // searches different text — per language, so switching must refetch rather
  // than reuse the previous language's cached pages.
  const categoryList = useInfiniteQuery({
    queryKey: ["faqs", "category", categorySlug, language],
    queryFn: ({ pageParam }) =>
      supportApi.faqs({ category: categorySlug, cursor: pageParam, lang: language }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: mode === "category" && !!categorySlug,
  });

  const searchList = useInfiniteQuery({
    queryKey: ["faqs", "search", urlQuery, language],
    queryFn: ({ pageParam }) =>
      supportApi.faqs({ q: urlQuery, cursor: pageParam, lang: language }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: mode === "search",
  });

  const active = mode === "search" ? searchList : categoryList;
  const items = useMemo(() => dedupe(active.data?.pages), [active.data]);

  // Restore the saved scroll offset for this list once its content is present.
  const scrollKey = params.toString();
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => scrollPositions.set(scrollKey, el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollKey]);
  const contentReady = mode === "landing" || (!active.isLoading && active.data !== undefined);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !contentReady) return;
    const saved = scrollPositions.get(scrollKey);
    if (saved != null) el.scrollTop = saved;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey, contentReady]);

  // Only a settled, successful, empty result is FAQ-(empty); loading and
  // failure are their own states and keep the heading.
  const categoryEmpty =
    !categoryList.isLoading && !categoryList.error && items.length === 0;

  const hasText = input.trim().length > 0;
  const searchActive = focused || hasText;

  function openDetail(faqId: string) {
    nav(`/faq/${encodeURIComponent(faqId)}`);
  }

  return (
    <div className={`faq ${focused ? "faq--searching" : ""}`}>
      <FaqHeader />

      <div className="faq__scroll" ref={scrollRef}>
        {/* Search area — warm cream band behind a white search field. */}
        <div className="faq__searchbar">
          <div className={`faq__search ${searchActive ? "faq__search--active" : ""} ${hasText ? "faq__search--filled" : ""}`}>
            <input
              className="faq__search-input"
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={t("faq.askAnything")}
              aria-label={t("faq.searchAria")}
              enterKeyHint="search"
            />
            <span className="faq__search-icon" aria-hidden="true">
              {/* ic_24_search (I879:22447;3021:65661) — Group 5719, a 19.44
                  glyph in a 24 box, stroke Gray 3 at 2.2. Was a hand-drawn
                  20px circle+line at 1.8. */}
              <img className="faq__search-ic" src={icSearch} alt="" width={19.4448} height={19.4448} />
            </span>
          </div>
        </div>

        <div className="faq__content">
          {/* FAQ-001. A client-side screen: the category list is fixed, so it
              renders without asking the server anything and is never skipped —
              whether the catalogue turns out to be empty is a question for the
              next level down (FAQ-002 / FAQ-(empty)), not this one. */}
          {mode === "landing" && (
            <div className="faq__cats">
              {FAQ_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="faq__cat-card"
                  onClick={() => setParams({ category: c.slug })}
                >
                  <span className="faq__cat-emoji" aria-hidden="true">{c.emoji}</span>
                  <span className="faq__cat-label">{t(c.label)}</span>
                  {/* Comp (568:19568) — the Gray 4 chevron, 16px box. */}
                  <span className="faq__cat-chevron" aria-hidden="true">
                    <img src={icChevron} alt="" width={6.5} height={11.5} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === "category" && category && (
            <>
              {/* FAQ-002 heads the list with the category; FAQ-(empty) has no
                  heading at all, just the line, so it is dropped when empty. */}
              {!categoryEmpty && (
                <h2 className="faq__heading">
                  <span aria-hidden="true">{category.emoji}</span> {t(category.label)}
                </h2>
              )}
              <ListBody
                loading={categoryList.isLoading}
                error={categoryList.error}
                items={items}
                onRetry={() => categoryList.refetch()}
                onOpen={openDetail}
                empty={<FaqEmpty text={t("faq.noQuestions")} />}
                hasNext={!!categoryList.hasNextPage}
                isFetchingNext={categoryList.isFetchingNextPage}
                loadMore={categoryList.fetchNextPage}
              />
            </>
          )}

          {mode === "search" && (
            <>
              <h2 className="faq__heading" role="status" aria-live="polite">
                <span aria-hidden="true">🔎</span> {t("faq.searchResults")} {searchList.isLoading ? "" : items.length}
              </h2>
              <ListBody
                loading={searchList.isLoading}
                error={searchList.error}
                items={items}
                onRetry={() => searchList.refetch()}
                onOpen={openDetail}
                empty={
                  <EmptyState
                    emoji="🔍"
                    title={t("faq.noResults")}
                    text={t("faq.noResultsDesc")}
                  />
                }
                hasNext={!!searchList.hasNextPage}
                isFetchingNext={searchList.isFetchingNextPage}
                loadMore={searchList.fetchNextPage}
              />
            </>
          )}
        </div>
      </div>

      <SupportChatButton />
    </div>
  );
}

/**
 * FAQ-(empty) 3393:27284 / 3393:27297 — a single Gray 5 line, centred on the
 * screen. The frame has no illustration, no heading/description pair and no
 * button: just the sentence, so that is all this renders.
 */
function FaqEmpty({ text }: { text: string }) {
  return (
    <p className="faq__empty" role="status">
      {text}
    </p>
  );
}

/** Loading / error / empty / list for a paginated question list. */
function ListBody({
  loading,
  error,
  items,
  onRetry,
  onOpen,
  empty,
  hasNext,
  isFetchingNext,
  loadMore,
}: {
  loading: boolean;
  error: unknown;
  items: FaqItem[];
  onRetry: () => void;
  onOpen: (faqId: string) => void;
  empty: React.ReactNode;
  hasNext: boolean;
  isFetchingNext: boolean;
  loadMore: () => void;
}) {
  if (loading && items.length === 0) return <SkeletonList rows={6} height={62} />;
  if (error && items.length === 0)
    return <ErrorState message={errorMessage(error)} onRetry={onRetry} />;
  if (items.length === 0) return <>{empty}</>;
  return (
    <div className="faq__list">
      {items.map((f) => (
        <QuestionCard key={f.faq_id} question={f.question} onClick={() => onOpen(f.faq_id)} />
      ))}
      <LoadMoreSentinel hasNext={hasNext} isFetching={isFetchingNext} onLoadMore={loadMore} />
    </div>
  );
}
