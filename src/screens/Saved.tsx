import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation, type TranslationKey } from "../i18n";
import { SkeletonList } from "../components/ui/states";
import { sentenceApi, quizApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { DashboardSummary, Quiz, SavedSentenceItem } from "../lib/types";
import icBookmarkFilled from "../assets/brand/ic-24-bookmark-filled.svg";
import svPlay from "../assets/brand/sv-play.svg";
import icTrash from "../assets/brand/ic-trash.svg";
import chipRepeat from "../assets/brand/chip-ic-repeat.svg";
import chipStar from "../assets/brand/chip-ic-star.svg";

/* ------------------------------- config -------------------------------- */
type Mode = "sentence" | "problem";
type Source = "wrong" | "bookmark";
type Sort = "latest" | "most_wrong" | "least_reviewed";
type Skill = "all" | "reading" | "listening" | "writing";
type MoreState = "idle" | "loading" | "error" | "done";
type FeedStatus = "loading" | "ready" | "error";

/* -------------------------- return-state cache -------------------------- */
// The screen unmounts when the user opens a saved question for review, so its
// loaded pages / scroll position would otherwise be lost. We snapshot the full
// feed into a module-level cache when navigating into a quiz, tagged with the
// /saved history entry's `loc.key` and the owning user. On the way back
// (`nav(-1)` returns to that same history entry → same key), the snapshot is
// restored verbatim; a fresh open from Home pushes a NEW history entry with a
// different key, so it starts clean. The user tag guards against account
// switches reusing a stale snapshot.
type SavedSnapshot = {
  userId: string | null;
  locKey: string;
  mode: Mode;
  source: Source;
  sort: Sort;
  skill: Skill;
  query: string;
  dq: string;
  items: (SavedSentenceItem | Quiz)[];
  cursor: string | null;
  more: MoreState;
  status: FeedStatus;
  scrollTop: number;
};
let savedSnapshot: SavedSnapshot | null = null;

// The tab (mode) Saved was left on to open a single-item review, keyed by the
// /saved history entry it belongs to. Restores the tab on return even when the
// full snapshot can't. Read IDEMPOTENTLY (never consumed) and scoped by loc.key —
// a consume-once flag is clobbered by React StrictMode's dev mount→unmount→mount
// double-invoke (the throwaway first mount ate it, so the real mount fell back to
// the Sentences default); the loc.key guard is what keeps a fresh visit from
// picking up a stale hint.
let savedModeHint: { locKey: string; mode: Mode } | null = null;

const SORT_LABEL_KEYS: Record<Sort, TranslationKey> = {
  latest: "saved.sortRecent",
  most_wrong: "saved.sortMostWrong",
  least_reviewed: "saved.sortLeastRecent",
};
const SENT_SORT: Record<Sort, string> = { latest: "latest", most_wrong: "most_wrong", least_reviewed: "least_recently_viewed" };
const QUIZ_SORT: Record<Sort, string> = { latest: "recent", most_wrong: "most_incorrect", least_reviewed: "longest_not_reviewed" };
const SKILLS: { v: Skill; l: TranslationKey }[] = [
  { v: "all", l: "saved.filterAll" },
  { v: "reading", l: "saved.filterReading" },
  { v: "listening", l: "saved.filterListening" },
  { v: "writing", l: "saved.filterWriting" },
];
const SKILL_LABEL_KEYS: Record<string, TranslationKey> = {
  reading: "saved.filterReading",
  listening: "saved.filterListening",
  writing: "saved.filterWriting",
};

const modeTitleKey = (m: Mode): TranslationKey =>
  m === "sentence" ? "saved.savedSentences" : "saved.savedQuestions";
const isSentence = (it: SavedSentenceItem | Quiz): it is SavedSentenceItem => "sentence_id" in it;
const itemId = (it: SavedSentenceItem | Quiz) => (isSentence(it) ? it.sentence_id : it.quiz_id);
function quizTitle(
  q: Quiz,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const skill =
    q.topik_question_type ||
    (q.topik_section && SKILL_LABEL_KEYS[q.topik_section] ? t(SKILL_LABEL_KEYS[q.topik_section]) : null);
  return t("saved.quizTitle", { level: q.level, skill: skill ? ` · ${skill}` : "" });
}
function dedup(list: (SavedSentenceItem | Quiz)[]): (SavedSentenceItem | Quiz)[] {
  const seen = new Set<string>();
  const out: (SavedSentenceItem | Quiz)[] = [];
  for (const it of list) {
    const id = itemId(it);
    if (!seen.has(id)) { seen.add(id); out.push(it); }
  }
  return out;
}

/* --------------------------------- icons -------------------------------- */
const Chevron = ({ dir = "down", color = "#9aa0a7", size = 18 }: { dir?: "down" | "left"; color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M6 9l6 6 6-6"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
/* 537:9628's delete control (572:23443) exports as one 12x14 path here, so the
 * drawn fallback is gone. */
const TrashIcon = () => (
  <img className="rev__action-ic" src={icTrash} alt="" aria-hidden="true" />
);
/* TAL-044's saved control (674:10241) is a real ic_24_text instance. */
const BookmarkFilled = () => (
  <img className="rev__action-bm" src={icBookmarkFilled} alt="" aria-hidden="true" />
);
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/* ------------------------------- screen -------------------------------- */
export function Saved() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { me } = useAuth();
  const userId = me?.user_id ?? null;
  const entry = (loc.state as { tab?: string; filter?: string } | null) ?? null;

  // Restore a snapshot only when we're back on the exact history entry we left
  // for a quiz review (same `loc.key`) and it belongs to the current user.
  // Resolve once per mount. Do NOT null out savedSnapshot here: StrictMode's
  // throwaway first mount would consume it and leave the real second mount with
  // nothing. The locKey/userId guard already prevents a stale entry from being
  // reused (a fresh visit has a different key).
  const snapRef = useRef<SavedSnapshot | null | undefined>(undefined);
  if (snapRef.current === undefined) {
    const cached = savedSnapshot;
    const canResume = !!cached && cached.locKey === loc.key && cached.userId === userId;
    snapRef.current = canResume ? cached : null;
  }
  const snap = snapRef.current;
  // Idempotent, key-scoped read (never consumed — StrictMode-safe).
  const modeHint: Mode | null =
    savedModeHint && savedModeHint.locKey === loc.key ? savedModeHint.mode : null;

  // Which track opens first is the user's Practice Settings priority, not a
  // fixed default. The dashboard's tracks are already in that order —
  // PersonalizedSettings persists the order and invalidates ["dashboard"] — and
  // every route into Saved comes from a screen that has already loaded it, so
  // this reads straight from the cache: no extra request and no flash of the
  // wrong tab. A cold cache falls back to Sentences, as before.
  const qc = useQueryClient();
  const preferredMode: Mode =
    qc.getQueryData<DashboardSummary>(["dashboard"])?.tracks?.[0]?.category === "topik"
      ? "problem"
      : "sentence";

  // Initial tab precedence:
  //   full snapshot › the tab we were on when we left for a review (modeHint) ›
  //   explicit navigation state › the Practice Settings priority.
  // modeHint is set ONLY when leaving Saved for a review, so it is a reliable
  // "returning from a review" signal and must beat `entry.tab` — which is the
  // STALE navigation state of this history entry, not the tab the user was
  // actually on when they left.
  const initialMode: Mode = snap
    ? snap.mode
    : modeHint
      ? modeHint
      : entry?.tab === "quiz"
        ? "problem"
        : entry?.tab === "sentence"
          ? "sentence"
          : preferredMode;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [source, setSource] = useState<Source>(snap ? snap.source : entry?.filter === "favorite" ? "bookmark" : "wrong");
  const [sort, setSort] = useState<Sort>(snap ? snap.sort : "latest");
  const [skill, setSkill] = useState<Skill>(snap ? snap.skill : "all");
  const [query, setQuery] = useState(snap ? snap.query : "");
  const [dq, setDq] = useState(snap ? snap.dq : "");
  const [modeMenu, setModeMenu] = useState(false);
  const [sortMenu, setSortMenu] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setDq(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  // --- audio ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    setPlayingId(null);
  }

  // Speaker button next to a saved sentence: fetch its signed audio URL and play
  // it right away. Re-tapping the same sentence stops it; tapping another swaps.
  async function toggleAudio(id: string) {
    if (playingId === id) {
      stopAudio();
      return;
    }
    stopAudio();
    setAudioLoadingId(id);
    try {
      const { url } = await sentenceApi.audio(id);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setPlayingId(null);
      a.onerror = () => {
        setPlayingId(null);
        toast.error(t("saved.audioError"));
      };
      await a.play();
      setPlayingId(id);
      void sentenceApi.markViewed(id).catch(() => {});
    } catch {
      toast.error(t("saved.audioError"));
    } finally {
      setAudioLoadingId(null);
    }
  }

  // --- feed state (state-based cursor pagination) ---
  const [items, setItems] = useState<(SavedSentenceItem | Quiz)[]>(snap ? snap.items : []);
  const [cursor, setCursor] = useState<string | null>(snap ? snap.cursor : null);
  const [status, setStatus] = useState<FeedStatus>(snap ? snap.status : "loading");
  const [more, setMore] = useState<MoreState>(snap ? snap.more : "idle");
  const seqRef = useRef(0);
  const moreLoadingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const saveType = source === "wrong" ? "auto_wrong" : "favorite";
  const key = useMemo(() => JSON.stringify({ mode, source, sort, skill, dq }), [mode, source, sort, skill, dq]);

  async function fetchPage(cur?: string): Promise<{ items: (SavedSentenceItem | Quiz)[]; next: string | null }> {
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
    stopAudio();
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
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver(
      (e) => { if (e[0].isIntersecting && more === "idle") void loadMore(); },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    ob.observe(el);
    return () => ob.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, cursor, items.length]);

  useEffect(() => () => stopAudio(), []);

  async function removeItem(it: SavedSentenceItem | Quiz) {
    const id = itemId(it);
    if (playingId === id) stopAudio();
    const prev = items;
    setItems((cur) => cur.filter((x) => itemId(x) !== id));
    try {
      if (isSentence(it)) {
        if (source === "wrong") await sentenceApi.clearAutoSave(id);
        else await sentenceApi.unbookmark(id);
      } else {
        if (source === "wrong") await quizApi.clearAutoSave(id);
        else await quizApi.unbookmark(id);
      }
    } catch (e) {
      setItems(prev);
      toast.error(errorMessage(e));
    }
  }

  // Keep a live mirror of everything the snapshot needs, so arming it at
  // navigation time is a cheap copy (no dependency on stale closures).
  const live = useRef<Omit<SavedSnapshot, "scrollTop">>(null!);
  live.current = { userId, locKey: loc.key, mode, source, sort, skill, query, dq, items, cursor, more, status };

  function openQuiz(q: Quiz) {
    stopAudio();
    // Record the open as a review touch so it drops down "오래 안 본 순" even if
    // the user never submits an answer (best-effort; ignore failures).
    void quizApi.markViewed(q.quiz_id).catch(() => {});
    savedSnapshot = { ...live.current, scrollTop: scrollRef.current?.scrollTop ?? 0 };
    savedModeHint = { locKey: loc.key, mode }; // restore this tab on return even without the snapshot
    // Start a single-item review session for this saved question.
    nav(`/review/question/${q.quiz_id}`);
  }

  // The orange button on a saved sentence starts a single-item review session —
  // it no longer plays audio inline in the list.
  function openSentence(s: { sentence_id: string }) {
    stopAudio();
    void sentenceApi.markViewed(s.sentence_id).catch(() => {});
    savedSnapshot = { ...live.current, scrollTop: scrollRef.current?.scrollTop ?? 0 };
    savedModeHint = { locKey: loc.key, mode };
    nav(`/review/sentence/${s.sentence_id}`);
  }

  function pickMode(m: Mode) {
    setModeMenu(false);
    if (m === mode) return;
    stopAudio();
    setMode(m);
  }

  const searching = dq.length > 0;
  // The empty frames use one message per mode and do NOT vary it by tab:
  // TAL-039(empty) is the 오답 tab and TAL-039(empty2) the 찜한 tab, and both
  // read "저장된 문장이 없어요". Same for TAL-043/044 on the question side.
  const emptyCopy = t(mode === "sentence" ? "saved.emptySentences" : "saved.emptyQuestions");

  return (
    <div className="screen rev">
      <div className="rev__scroll" ref={scrollRef}>
        <header className="rev__header">
          <button className="rev__back" onClick={() => { stopAudio(); nav(-1); }} aria-label={t("common.back")}>
            <Chevron dir="left" color="#262c31" size={26} />
          </button>
          <button className="rev__modebtn" onClick={() => { setSortMenu(false); setModeMenu((o) => !o); }} aria-haspopup="menu" aria-expanded={modeMenu}>
            <span className="rev__modetitle">{t(modeTitleKey(mode))}</span>
            <Chevron dir="down" color="#9aa0a7" size={18} />
          </button>
          {modeMenu && (
            <>
              <div className="rev__backdrop" onClick={() => setModeMenu(false)} />
              <div className="rev__menu rev__menu--mode" role="menu">
                {(["sentence", "problem"] as Mode[]).map((m) => (
                  <button key={m} role="menuitemradio" aria-checked={m === mode} className={`rev__menu-item ${m === mode ? "is-active" : ""}`} onClick={() => pickMode(m)}>
                    {t(modeTitleKey(m))}
                  </button>
                ))}
              </div>
            </>
          )}
        </header>

        <div className="rev__controls">
          <div className="rev__row1">
            <div className="rev__tabs" role="tablist" aria-label={t("saved.sourceLabel")}>
              {(["wrong", "bookmark"] as Source[]).map((s) => {
                const active = source === s;
                const label = t(
                  mode === "sentence"
                    ? s === "wrong" ? "saved.wrongSentences" : "saved.likedSentences"
                    : s === "wrong" ? "saved.wrongQuestions" : "saved.likedQuestions",
                );
                return (
                  <button key={s} role="tab" aria-selected={active} className={`rev__tab ${active ? "is-active" : ""}`} onClick={() => source !== s && setSource(s)}>
                    {/* Both chip glyphs are Figma exports stroked #6E7385 and
                        neither recolours on the active state (537:9710 repeat,
                        537:9713 star), so they carry no tint prop. */}
                    <img
                      className={`rev__tab-ic ${s === "wrong" ? "" : "rev__tab-ic--star"}`}
                      src={s === "wrong" ? chipRepeat : chipStar}
                      alt=""
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="rev__sort">
              <button className="rev__sortbtn" onClick={() => { setModeMenu(false); setSortMenu((o) => !o); }} aria-haspopup="menu" aria-expanded={sortMenu}>
                <span>{t(SORT_LABEL_KEYS[sort])}</span>
                <Chevron dir="down" color="#9aa0a7" size={16} />
              </button>
              {sortMenu && (
                <>
                  <div className="rev__backdrop" onClick={() => setSortMenu(false)} />
                  <div className="rev__menu rev__menu--sort" role="menu">
                    {(Object.keys(SORT_LABEL_KEYS) as Sort[]).map((s) => (
                      <button key={s} role="menuitemradio" aria-checked={s === sort} className={`rev__menu-item ${s === sort ? "is-active" : ""}`} onClick={() => { setSortMenu(false); if (s !== sort) setSort(s); }}>
                        {t(SORT_LABEL_KEYS[s])}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`rev__search ${query ? "is-filled" : ""}`}>
            <input className="rev__search-input" placeholder={t("saved.search")} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t("saved.search")} />
            <span className="rev__search-icon" aria-hidden="true"><SearchIcon /></span>
          </div>

          {mode === "problem" && (
            <div className="rev__skills" role="radiogroup" aria-label={t("saved.topikSection")}>
              {SKILLS.map((sk) => (
                <button key={sk.v} role="radio" aria-checked={skill === sk.v} className={`rev__chip ${skill === sk.v ? "is-active" : ""}`} onClick={() => skill !== sk.v && setSkill(sk.v)}>
                  {t(sk.l)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rev__panel">
          {status === "loading" ? (
            <div className="rev__list"><SkeletonList rows={5} height={62} /></div>
          ) : status === "error" ? (
            <div className="rev__state">
              <span>{t("saved.loadError")}</span>
              <button className="rev__retry" onClick={() => setReloadTick((t) => t + 1)}>{t("common.retry")}</button>
            </div>
          ) : items.length === 0 ? (
            <p className={`rev__empty${mode === "problem" ? " rev__empty--problem" : ""}`}>
              {searching ? t("saved.noResults") : emptyCopy}
            </p>
          ) : (
            <ul className="rev__list" role="list">
              {items.map((it) =>
                isSentence(it) ? (
                  <li key={it.sentence_id} className="rev__row">
                    <div className="rev__main">
                      <div className="rev__ko">
                        <span className="rev__ko-text">{it.korean}</span>
                        <button
                          className={`rev__speaker ${playingId === it.sentence_id ? "is-playing" : ""}`}
                          onClick={() => toggleAudio(it.sentence_id)}
                          aria-label={t(playingId === it.sentence_id ? "saved.stopSentenceA11y" : "saved.playSentenceA11y", {
                            sentence: it.korean,
                          })}
                        >
                          {audioLoadingId === it.sentence_id ? (
                            <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} />
                          ) : (
                            /* Masked, not an <img>: the export is stroked #5ECECE,
                               and the glyph has to switch between the idle and
                               playing colours. */
                            <span className="rev__speaker-ic" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <div className="rev__tr">{it.translation}</div>
                    </div>
                    <button className="rev__play" onClick={() => openSentence(it)} aria-label={t("saved.reviewSentenceA11y", { sentence: it.korean })}>
                      <img src={svPlay} alt="" aria-hidden="true" />
                    </button>
                    <button className="rev__action" onClick={() => removeItem(it)} aria-label={t(source === "wrong" ? "saved.removeFromWrong" : "saved.unbookmark")}>
                      {source === "wrong" ? <TrashIcon /> : <BookmarkFilled />}
                    </button>
                  </li>
                ) : (
                  <li key={it.quiz_id} className="rev__row">
                    <div className="rev__main">
                      <div className="rev__qtitle">{quizTitle(it, t)}</div>
                      <div className="rev__qprompt">{it.prompt}</div>
                    </div>
                    <button className="rev__play" onClick={() => openQuiz(it)} aria-label={t("saved.reviewQuestionA11y", { title: quizTitle(it, t) })}>
                      <img src={svPlay} alt="" aria-hidden="true" />
                    </button>
                    <button className="rev__action" onClick={() => removeItem(it)} aria-label={t(source === "wrong" ? "saved.removeFromWrong" : "saved.unbookmark")}>
                      {source === "wrong" ? <TrashIcon /> : <BookmarkFilled />}
                    </button>
                  </li>
                ),
              )}
              <div className="rev__foot" ref={sentinel}>
                {more === "loading" ? (
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                ) : more === "error" ? (
                  <button className="rev__retry" onClick={() => { setMore("idle"); void loadMore(); }}>{t("saved.loadMore")}</button>
                ) : null}
              </div>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
