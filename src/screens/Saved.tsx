import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { SkeletonList } from "../components/ui/states";
import { sentenceApi, quizApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { DashboardSummary, Quiz } from "../lib/types";
import { rememberSavedTab, readSavedTab, type SavedOrigin } from "../lib/savedReturn";
import chipRepeat from "../assets/brand/chip-ic-repeat.svg";
import chipStar from "../assets/brand/chip-ic-star.svg";
import { Spinner } from "../components/ui/Spinner";
import {
  SORT_LABEL_KEYS,
  SKILLS,
  isSentence,
  itemId,
  keepSnapshot,
  modeTitleKey,
  resumableSnapshot,
  type Mode,
  type SavedItem,
  type SavedSnapshot,
  type Skill,
  type Sort,
  type Source,
} from "./saved/config";
import { PickMenu, QuizRow, SentenceRow } from "./saved/SavedRows";
import { useSavedAudio } from "./saved/useSavedAudio";
import { useSavedFeed } from "./saved/useSavedFeed";

/* --------------------------------- icons -------------------------------- */
const Chevron = ({ dir = "down", color = "#9aa0a7", size = 18 }: { dir?: "down" | "left"; color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M6 9l6 6 6-6"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
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
  if (snapRef.current === undefined) snapRef.current = resumableSnapshot(loc.key, userId);
  const snap = snapRef.current;
  // Idempotent, key-scoped read (never consumed — StrictMode-safe).
  const modeHint: Mode | null = readSavedTab(loc.key);

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

  useEffect(() => {
    const t = window.setTimeout(() => setDq(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);

  const audio = useSavedAudio();
  const stopAudio = audio.stop;

  const feed = useSavedFeed({ snap, mode, source, sort, skill, dq, onReload: stopAudio });
  const { items, setItems, cursor, more, status, scrollRef } = feed;

  async function removeItem(it: SavedItem) {
    const id = itemId(it);
    if (audio.playingId === id) stopAudio();
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

  // Handed to a review session so 완료 / back come back to THIS category and
  // feed. `rememberSavedTab` covers the same-session return (and lets Saved
  // restore the tab even when the feed snapshot can't); the route state is what
  // survives a refresh mid-session, when the module hint is gone.
  const reviewOrigin = (): SavedOrigin => ({ savedKey: loc.key, tab: mode, source });

  function openQuiz(q: Quiz) {
    stopAudio();
    // Record the open as a review touch so it drops down "오래 안 본 순" even if
    // the user never submits an answer (best-effort; ignore failures).
    void quizApi.markViewed(q.quiz_id).catch(() => {});
    keepSnapshot({ ...live.current, scrollTop: scrollRef.current?.scrollTop ?? 0 });
    rememberSavedTab(loc.key, mode);
    // Start a single-item review session for this saved question.
    nav(`/review/question/${q.quiz_id}`, { state: reviewOrigin() });
  }

  // The orange button on a saved sentence starts a single-item review session —
  // it no longer plays audio inline in the list.
  function openSentence(s: { sentence_id: string }) {
    stopAudio();
    void sentenceApi.markViewed(s.sentence_id).catch(() => {});
    keepSnapshot({ ...live.current, scrollTop: scrollRef.current?.scrollTop ?? 0 });
    rememberSavedTab(loc.key, mode);
    nav(`/review/sentence/${s.sentence_id}`, { state: reviewOrigin() });
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
            <PickMenu
              className="rev__menu--mode"
              options={["sentence", "problem"] as Mode[]}
              value={mode}
              label={(m) => t(modeTitleKey(m))}
              onPick={pickMode}
              onClose={() => setModeMenu(false)}
            />
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
                <PickMenu
                  className="rev__menu--sort"
                  options={Object.keys(SORT_LABEL_KEYS) as Sort[]}
                  value={sort}
                  label={(o) => t(SORT_LABEL_KEYS[o])}
                  onPick={(o) => {
                    setSortMenu(false);
                    if (o !== sort) setSort(o);
                  }}
                  onClose={() => setSortMenu(false)}
                />
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
              <button className="rev__retry" onClick={feed.reload}>{t("common.retry")}</button>
            </div>
          ) : items.length === 0 ? (
            <p className={`rev__empty${mode === "problem" ? " rev__empty--problem" : ""}`}>
              {searching ? t("saved.noResults") : emptyCopy}
            </p>
          ) : (
            <ul className="rev__list" role="list">
              {items.map((it) =>
                isSentence(it) ? (
                  <SentenceRow
                    key={it.sentence_id}
                    item={it}
                    source={source}
                    playing={audio.playingId === it.sentence_id}
                    loadingAudio={audio.loadingId === it.sentence_id}
                    onToggleAudio={() => audio.toggle(it.sentence_id)}
                    onReview={() => openSentence(it)}
                    onRemove={() => removeItem(it)}
                  />
                ) : (
                  <QuizRow key={it.quiz_id} item={it} source={source} t={t} onReview={() => openQuiz(it)} onRemove={() => removeItem(it)} />
                ),
              )}
              <div className="rev__foot" ref={feed.sentinel}>
                {more === "loading" ? (
                  <Spinner size={20} stroke={2} />
                ) : more === "error" ? (
                  <button className="rev__retry" onClick={feed.retryMore}>{t("saved.loadMore")}</button>
                ) : null}
              </div>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
