import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SkeletonList } from "../components/ui/states";
import { sentenceApi, quizApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { Quiz, SavedSentenceItem } from "../lib/types";

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

const SORT_LABEL: Record<Sort, string> = {
  latest: "최신순",
  most_wrong: "오답 많은 순",
  least_reviewed: "오래 안 본 순",
};
const SENT_SORT: Record<Sort, string> = { latest: "latest", most_wrong: "most_wrong", least_reviewed: "least_recently_viewed" };
const QUIZ_SORT: Record<Sort, string> = { latest: "recent", most_wrong: "most_incorrect", least_reviewed: "longest_not_reviewed" };
const SKILLS: { v: Skill; l: string }[] = [
  { v: "all", l: "전체" },
  { v: "reading", l: "읽기" },
  { v: "listening", l: "듣기" },
  { v: "writing", l: "쓰기" },
];
const SKILL_LABEL: Record<string, string> = { reading: "읽기", listening: "듣기", writing: "쓰기" };

const modeTitle = (m: Mode) => (m === "sentence" ? "저장한 문장" : "저장한 문제");
const isSentence = (it: SavedSentenceItem | Quiz): it is SavedSentenceItem => "sentence_id" in it;
const itemId = (it: SavedSentenceItem | Quiz) => (isSentence(it) ? it.sentence_id : it.quiz_id);
function quizTitle(q: Quiz): string {
  const skill = q.topik_question_type || (q.topik_section ? SKILL_LABEL[q.topik_section] : null);
  return `[TOPIK ${q.level}급${skill ? ` · ${skill}` : ""}]`;
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
const Speaker = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" fill="#36c4c8" />
    <path d="M16 8.5a4 4 0 0 1 0 7" stroke="#36c4c8" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const PlayGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" /></svg>
);
const PauseGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="#fff" />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="#fff" />
  </svg>
);
const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7M6.5 7l.8 11a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" stroke="#aeb7be" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const BookmarkFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.5L6 20V5a1 1 0 0 1 1-1z" fill="#FF5B00" /></svg>
);
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const RepeatIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M4 8a4 4 0 0 1 4-4h9M20 16a4 4 0 0 1-4 4H7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 1l3 3-3 3M10 23l-3-3 3-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const StarOutline = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 3.5l2.5 5.2 5.5.6-4 3.9 1 5.6L12 21l-5-2.7 1-5.6-4-3.9 5.5-.6L12 3.5z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/* ------------------------------- screen -------------------------------- */
export function Saved() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const { me } = useAuth();
  const userId = me?.user_id ?? null;
  const entry = (loc.state as { tab?: string; filter?: string } | null) ?? null;

  // Restore a snapshot only when we're back on the exact history entry we left
  // for a quiz review (same `loc.key`) and it belongs to the current user.
  // Resolve once per mount (`undefined` = not yet resolved) and consume the
  // cache so a later fresh visit never picks up a stale snapshot.
  const snapRef = useRef<SavedSnapshot | null | undefined>(undefined);
  if (snapRef.current === undefined) {
    const cached = savedSnapshot;
    const canResume = !!cached && cached.locKey === loc.key && cached.userId === userId;
    snapRef.current = canResume ? cached : null;
    if (cached && cached.locKey === loc.key) savedSnapshot = null;
  }
  const snap = snapRef.current;

  const [mode, setMode] = useState<Mode>(snap ? snap.mode : entry?.tab === "quiz" ? "problem" : "sentence");
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

  async function toggleAudio(id: string) {
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    setAudioLoadingId(id);
    try {
      const { url } = await sentenceApi.audio(id);
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setPlayingId(null);
      a.onerror = () => { setPlayingId(null); toast.error("오디오를 재생할 수 없어요."); };
      await a.play();
      setPlayingId(id);
      void sentenceApi.markViewed(id);
    } catch {
      toast.error("오디오를 재생할 수 없어요.");
    } finally {
      setAudioLoadingId(null);
    }
  }
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
    nav(`/quiz/${q.quiz_id}`, { state: { source: "review" } });
  }

  function pickMode(m: Mode) {
    setModeMenu(false);
    if (m === mode) return;
    stopAudio();
    setMode(m);
  }

  const searching = dq.length > 0;
  const emptyCopy =
    mode === "sentence"
      ? source === "wrong" ? "저장된 오답 문장이 없어요" : "찜한 문장이 없어요"
      : source === "wrong" ? "저장된 오답 문제가 없어요" : "찜한 문제가 없어요";

  return (
    <div className="screen rev">
      <div className="rev__scroll" ref={scrollRef}>
        <header className="rev__header">
          <button className="rev__back" onClick={() => { stopAudio(); nav(-1); }} aria-label="뒤로">
            <Chevron dir="left" color="#272c30" size={26} />
          </button>
          <button className="rev__modebtn" onClick={() => { setSortMenu(false); setModeMenu((o) => !o); }} aria-haspopup="menu" aria-expanded={modeMenu}>
            <span className="rev__modetitle">{modeTitle(mode)}</span>
            <Chevron dir="down" color="#9aa0a7" size={18} />
          </button>
          {modeMenu && (
            <>
              <div className="rev__backdrop" onClick={() => setModeMenu(false)} />
              <div className="rev__menu rev__menu--mode" role="menu">
                {(["sentence", "problem"] as Mode[]).map((m) => (
                  <button key={m} role="menuitemradio" aria-checked={m === mode} className={`rev__menu-item ${m === mode ? "is-active" : ""}`} onClick={() => pickMode(m)}>
                    {modeTitle(m)}
                  </button>
                ))}
              </div>
            </>
          )}
        </header>

        <div className="rev__controls">
          <div className="rev__row1">
            <div className="rev__tabs" role="tablist" aria-label="저장 소스">
              {(["wrong", "bookmark"] as Source[]).map((s) => {
                const active = source === s;
                const label = mode === "sentence" ? (s === "wrong" ? "오답 문장" : "찜한 문장") : s === "wrong" ? "오답 문제" : "찜한 문제";
                const c = active ? "#FF5B00" : "#8b939b";
                return (
                  <button key={s} role="tab" aria-selected={active} className={`rev__tab ${active ? "is-active" : ""}`} onClick={() => source !== s && setSource(s)}>
                    {s === "wrong" ? <RepeatIcon color={c} /> : <StarOutline color={c} />}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="rev__sort">
              <button className="rev__sortbtn" onClick={() => { setModeMenu(false); setSortMenu((o) => !o); }} aria-haspopup="menu" aria-expanded={sortMenu}>
                <span>{SORT_LABEL[sort]}</span>
                <Chevron dir="down" color="#9aa0a7" size={16} />
              </button>
              {sortMenu && (
                <>
                  <div className="rev__backdrop" onClick={() => setSortMenu(false)} />
                  <div className="rev__menu rev__menu--sort" role="menu">
                    {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
                      <button key={s} role="menuitemradio" aria-checked={s === sort} className={`rev__menu-item ${s === sort ? "is-active" : ""}`} onClick={() => { setSortMenu(false); if (s !== sort) setSort(s); }}>
                        {SORT_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className={`rev__search ${query ? "is-filled" : ""}`}>
            <input className="rev__search-input" placeholder="찾기" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="검색" />
            <span className="rev__search-icon" aria-hidden="true"><SearchIcon /></span>
          </div>

          {mode === "problem" && (
            <div className="rev__skills" role="radiogroup" aria-label="TOPIK 영역">
              {SKILLS.map((sk) => (
                <button key={sk.v} role="radio" aria-checked={skill === sk.v} className={`rev__chip ${skill === sk.v ? "is-active" : ""}`} onClick={() => skill !== sk.v && setSkill(sk.v)}>
                  {sk.l}
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
              <span>불러오지 못했어요.</span>
              <button className="rev__retry" onClick={() => setReloadTick((t) => t + 1)}>다시 시도</button>
            </div>
          ) : items.length === 0 ? (
            <p className="rev__empty">{searching ? "검색결과가 없어요" : emptyCopy}</p>
          ) : (
            <ul className="rev__list" role="list">
              {items.map((it) =>
                isSentence(it) ? (
                  <li key={it.sentence_id} className="rev__row">
                    <div className="rev__main">
                      <div className="rev__ko">
                        <span className="rev__ko-text">{it.korean}</span>
                        <span className="rev__speaker" aria-hidden="true"><Speaker /></span>
                      </div>
                      <div className="rev__tr">{it.translation}</div>
                    </div>
                    <button className="rev__play" onClick={() => toggleAudio(it.sentence_id)} aria-label={`${it.korean} 문장 듣기`}>
                      {audioLoadingId === it.sentence_id ? (
                        <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                      ) : playingId === it.sentence_id ? <PauseGlyph /> : <PlayGlyph />}
                    </button>
                    <button className="rev__action" onClick={() => removeItem(it)} aria-label={source === "wrong" ? "오답에서 삭제" : "찜 해제"}>
                      {source === "wrong" ? <TrashIcon /> : <BookmarkFilled />}
                    </button>
                  </li>
                ) : (
                  <li key={it.quiz_id} className="rev__row">
                    <div className="rev__main">
                      <div className="rev__qtitle">{quizTitle(it)}</div>
                      <div className="rev__qprompt">{it.prompt}</div>
                    </div>
                    <button className="rev__play" onClick={() => openQuiz(it)} aria-label={`${quizTitle(it)} 문제 복습하기`}>
                      <PlayGlyph />
                    </button>
                    <button className="rev__action" onClick={() => removeItem(it)} aria-label={source === "wrong" ? "오답에서 삭제" : "찜 해제"}>
                      {source === "wrong" ? <TrashIcon /> : <BookmarkFilled />}
                    </button>
                  </li>
                ),
              )}
              <div className="rev__foot" ref={sentinel}>
                {more === "loading" ? (
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                ) : more === "error" ? (
                  <button className="rev__retry" onClick={() => { setMore("idle"); void loadMore(); }}>다시 불러오기</button>
                ) : null}
              </div>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
