import { useEffect, useMemo, useRef, useState } from "react";
import { quizApi, sentenceApi } from "../../api/endpoints";
import { useLoadMoreSentinel } from "../../hooks/useLoadMoreSentinel";
import {
  QUIZ_SORT,
  SENT_SORT,
  dedup,
  type FeedStatus,
  type Mode,
  type MoreState,
  type SavedItem,
  type SavedSnapshot,
  type Skill,
  type Sort,
  type Source,
} from "./config";

/**
 * The saved feed: cursor pages for the current mode, tab, sort, section and
 * search, reloaded from page 1 whenever any of them changes — or resumed
 * verbatim from `snap` on the way back from a review. A reply for a query
 * that has since changed is dropped.
 */
export function useSavedFeed({
  snap,
  mode,
  source,
  sort,
  skill,
  dq,
  onReload,
}: {
  snap: SavedSnapshot | null;
  mode: Mode;
  source: Source;
  sort: Sort;
  skill: Skill;
  dq: string;
  /** Runs as a reload starts (the audio stops with the old list). */
  onReload: () => void;
}) {
  const [items, setItems] = useState<SavedItem[]>(snap ? snap.items : []);
  const [cursor, setCursor] = useState<string | null>(snap ? snap.cursor : null);
  const [status, setStatus] = useState<FeedStatus>(snap ? snap.status : "loading");
  const [more, setMore] = useState<MoreState>(snap ? snap.more : "idle");
  const [reloadTick, setReloadTick] = useState(0);
  const seqRef = useRef(0);
  const moreLoadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const saveType = source === "wrong" ? "auto_wrong" : "favorite";
  const key = useMemo(() => JSON.stringify({ mode, source, sort, skill, dq }), [mode, source, sort, skill, dq]);

  async function fetchPage(cur?: string): Promise<{ items: SavedItem[]; next: string | null }> {
    if (mode === "sentence") {
      const page = await sentenceApi.saved({ save_type: saveType, sort: SENT_SORT[sort], q: dq || undefined, cursor: cur });
      return { items: page.items, next: page.next_cursor };
    }
    const page = await quizApi.bookmarks({ save_type: saveType, section: skill, sort: QUIZ_SORT[sort], q: dq || undefined, cursor: cur });
    return { items: page.items, next: page.next_cursor ?? null };
  }

  // Reload page 1 whenever the composite query (or retry tick) changes. On the
  // very first run after restoring a snapshot, skip the fetch and re-apply the
  // saved scroll position instead — the loaded pages are already in state.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      if (snap) {
        const top = snap.scrollTop;
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = top;
        });
        return;
      }
    }
    const mySeq = ++seqRef.current;
    setStatus("loading");
    setItems([]);
    setCursor(null);
    setMore("idle");
    onReload();
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    (async () => {
      try {
        const page = await fetchPage(undefined);
        if (mySeq !== seqRef.current) return;
        setItems(dedup(page.items));
        setCursor(page.next);
        setMore(page.next ? "idle" : "done");
        setStatus("ready");
      } catch {
        if (mySeq === seqRef.current) setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reloadTick]);

  async function loadMore() {
    if (moreLoadingRef.current || cursor == null) return;
    moreLoadingRef.current = true;
    const mySeq = seqRef.current;
    setMore("loading");
    try {
      const page = await fetchPage(cursor);
      if (mySeq !== seqRef.current) return;
      setItems((prev) => dedup([...prev, ...page.items]));
      setCursor(page.next);
      setMore(page.next ? "idle" : "done");
    } catch {
      if (mySeq === seqRef.current) setMore("error");
    } finally {
      moreLoadingRef.current = false;
    }
  }

  const sentinel = useRef<HTMLDivElement>(null);
  useLoadMoreSentinel(sentinel, { enabled: more === "idle", onHit: () => void loadMore(), rootRef: scrollRef, rootMargin: "300px" }, [more, cursor, items.length]);

  return {
    items,
    setItems,
    cursor,
    more,
    status,
    scrollRef,
    sentinel,
    reload: () => setReloadTick((n) => n + 1),
    retryMore: () => {
      setMore("idle");
      void loadMore();
    },
  };
}
