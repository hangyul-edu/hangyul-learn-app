import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSavedReturn } from "../lib/savedReturn";
import { useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import icBookmark from "../assets/brand/ic-card-bookmark.svg";
import icMic from "../assets/brand/ic-session-mic.svg";
import icBookmarkOn from "../assets/brand/ic-24-bookmark-filled.svg";
import { CorrectAnswerSheet } from "../components/CorrectAnswerSheet";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, sentenceApi, dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import { randomUuid } from "../lib/uuid";
import {
  useSessionConversationCopy,
  type SessionConversationCopy,
} from "../lib/sessionConversationCopy";
import type { BlankAttempt, Sentence, SpeechAttempt } from "../lib/types";
import icSend from "../assets/brand/ic-send.svg";
import icQuestion from "../assets/brand/ic-question.svg";
import icAlert from "../assets/brand/ic-24-alert.svg";

/** Which input produced the last evaluated attempt — decides whether the
 * pronunciation panel (voice only) is shown. */
type AttemptMode = "keyboard" | "voice";

/** A conversation item is a fill-in-the-blank when it ships a `display_text`
 * with a blank and structured blank metadata. */
function hasBlank(s: Sentence): boolean {
  return !!s.display_text && s.display_text.includes("___") && (s.blanks?.length ?? 0) > 0;
}

/** Map the fill-in-the-blank result onto the existing SpeechAttempt feedback
 * shape so the correct/incorrect/progress UI is reused unchanged. */
function blankToSpeech(b: BlankAttempt): SpeechAttempt {
  return {
    attempt_id: b.attempt_id,
    correct: b.is_correct,
    transcription: b.transcription ?? b.normalized_answer,
    target_text: b.completed_sentence,
    pronunciation_score: b.is_correct ? 100 : 0,
    feedback_code: b.is_correct ? "correct" : "missed_words",
    points_earned: b.points_earned,
    daily_progress: b.daily_progress ?? null,
  };
}

function newRequestId(): string {
  return randomUuid();
}

/** Clamp any returned score to a safe 0–100 integer for display + a11y. */
function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Actionable pronunciation feedback from the evaluation result. Prefers the
 * server's already-localized tips; falls back to a safe localized message so a
 * raw provider/API error is never surfaced to the learner. */
function pronunciationMessage(res: SpeechAttempt, copy: SessionConversationCopy): string {
  const tip = res.tips?.find((t) => t.trim().length > 0);
  return tip?.trim() || copy.pronunciationFallback;
}

/** Key for the in-progress conversation session snapshot. It is persisted so a
 * page refresh restores the exact same set and progress instead of requesting
 * brand-new content. Scoped to the browser tab via sessionStorage and cleared
 * when the session is finished or exited. */
const SESSION_KEY = "hangyul.session.conversation.v1";

type SessionSnapshot = {
  items: Sentence[];
  idx: number;
  points: number;
  correct: string[];
  answered: string[];
  saved: Record<string, boolean>;
  revealed: Record<string, string>;
  hintStage: Record<string, "hint" | "answer">;
  prompt: string;
  startedAt: number;
  keyboard: boolean;
  // Additional-learning batch size (5/10/15/20), or null for a normal session.
  additionalCount: number | null;
};

function readSessionSnapshot(): SessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SessionSnapshot;
    return Array.isArray(s.items) && s.items.length > 0 ? s : null;
  } catch {
    return null;
  }
}

function clearSessionSnapshot() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Renders `display_text` as one inline sentence: prefix text, the mint blank
 * (a revealed-hint chip in voice mode, or an inline text input in keyboard
 * mode), then suffix text. Falls back to the full sentence when there is no
 * blank. Never renders the answer. */
function FillSentence({
  sentence,
  keyboard,
  typed,
  onTyped,
  revealed,
  onSubmit,
  submitting,
  composingRef,
}: {
  sentence: Sentence;
  keyboard: boolean;
  typed: string;
  onTyped: (v: string) => void;
  revealed: string;
  onSubmit: () => void;
  submitting: boolean;
  composingRef: React.MutableRefObject<boolean>;
}) {
  const { t } = useTranslation();
  if (!hasBlank(sentence)) {
    return <div className="sess__sentence">{sentence.korean}</div>;
  }
  const parts = (sentence.display_text ?? "").split("___");
  const widthEm = sentence.blanks?.[0]?.display_width_em ?? 6;
  return (
    <div className="sess__sentence sess__sentence--fill">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 &&
            (keyboard ? (
              <span className="sess__blank sess__blank--edit">
                {/* The revealed hint is the input's placeholder — it shows the
                    partial answer while empty and is replaced the moment the
                    user types (not a separate element beside the input). */}
                <input
                  className="sess__blank-input"
                  style={{ width: `${widthEm}em` }}
                  value={typed}
                  placeholder={revealed}
                  onChange={(e) => onTyped(e.target.value)}
                  onCompositionStart={() => (composingRef.current = true)}
                  onCompositionEnd={() => (composingRef.current = false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !composingRef.current) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                  disabled={submitting}
                  autoFocus
                  lang="ko"
                  enterKeyHint="go"
                  aria-label={t("session.blankWord")}
                />
              </span>
            ) : (
              <span
                className="sess__blank"
                style={{ minWidth: `${widthEm}em` }}
                aria-label={revealed ? t("session.blankHint", { hint: revealed }) : t("session.blank")}
              >
                {revealed || " "}
              </span>
            ))}
        </span>
      ))}
    </div>
  );
}




/** Circular pronunciation-accuracy ring: gray inactive track + orange active arc
 * with the clamped percentage centered. Decorative — the accessible value is
 * announced by the panel's group label. */
function ScoreRing({ percent }: { percent: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - percent / 100);
  return (
    <svg className="sess__pron-ring" width="63" height="63" viewBox="0 0 66 66" aria-hidden="true" focusable="false">
      <circle cx="33" cy="33" r={r} fill="none" stroke="#ecedf0" strokeWidth="7" />
      <circle
        cx="33"
        cy="33"
        r={r}
        fill="none"
        stroke="#ff8a3d"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 33 33)"
      />
      <text x="33" y="34" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fill="#262c31">
        {percent}%
      </text>
    </svg>
  );
}

/** Voice-only pronunciation feedback: score ring + one actionable message. */
function PronunciationPanel({
  score,
  message,
  copy,
}: {
  score: number;
  message: string;
  copy: SessionConversationCopy;
}) {
  const percent = clampScore(score);
  return (
    <div className="sess__pron" role="group" aria-label={copy.scoreA11y(percent)}>
      <ScoreRing percent={percent} />
      <div className="sess__pron-text">
        <div className="sess__pron-title">{copy.pronunciationTitle}</div>
        <p className="sess__pron-msg">{message}</p>
      </div>
    </div>
  );
}

/** Remaining items to satisfy today's conversation goal (server-derived). */
function useRemaining() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const t = q.data?.tracks.find((x) => x.category === "conversation");
  const remaining = t ? Math.max(t.goal.target - t.goal.current, 0) : 0;
  return { remaining, level: t?.level ?? 1 };
}

export function SessionConversation() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  const copy = useSessionConversationCopy();
  const reviewCopy = useReviewSessionCopy();
  // Single-item review mode: reached via /review/sentence/:sentenceId. Reuses the
  // whole answer flow but with one fixed saved sentence, source="review" attempts
  // (server awards review points, skips goal/level), no progress/config chrome,
  // and a review completion sheet + reward modal instead of the session summary.
  const { sentenceId: reviewSentenceId } = useParams();
  const isReview = !!reviewSentenceId;
  // Used only in review mode: back / 확인 return to the saved-learning category
  // this session was opened from (see SessionReview for the mirror case).
  const backToSaved = useSavedReturn("sentence");
  const [rewardOpen, setRewardOpen] = useState(false);
  const attemptSource = isReview ? "review" : "custom";
  // Where the session was launched from (Home / Personalized), forwarded to the
  // Level-Up screen so its button returns the user to that source page.
  const navState = loc.state as { from?: string; additionalCount?: number } | null;
  const from = navState?.from ?? "/home";
  const { remaining, level } = useRemaining();
  // Additional-learning batch size (5/10/15/20), set only when the user opted
  // into extra study after completing today's goal; null for a normal session.
  const [additionalCount, setAdditionalCount] = useState<number | null>(
    navState?.additionalCount ?? null,
  );

  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Sentence[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  // Per-sentence hint stage. Absent = untouched (button reads 힌트보기); "hint" =
  // one leading character revealed (button becomes 정답보기); "answer" = the whole
  // answer revealed (button hidden). Keyed by sentence_id so each item is
  // independent and advancing to the next item resets the button automatically.
  const [hintStage, setHintStage] = useState<Record<string, "hint" | "answer">>({});
  const [keyboard, setKeyboard] = useState(false);
  const [typed, setTyped] = useState("");
  // Per-sentence server-revealed hint prefix (persists across mode switches /
  // rerenders for the current item).
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const composingRef = useRef(false); // true while a Korean IME composition is active
  const reqIdRef = useRef<string | null>(null); // idempotency key for the current item's attempt
  // Review mode only: identifies THIS review session to the server so review
  // points are awarded once per session. Fresh per mount (a new session), but
  // preserved across `reviewRestart` — so re-answering the same item after a
  // restart collides on the key server-side and is not re-awarded.
  const reviewSessionIdRef = useRef<string>(randomUuid());
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<SpeechAttempt | null>(null);
  // Which input produced `result` — the pronunciation panel is voice-only.
  const [attemptMode, setAttemptMode] = useState<AttemptMode | null>(null);
  // Monotonic attempt token. A response is applied only if it is still the
  // latest attempt, so a late reply from a previous attempt or a now-switched
  // mode can never overwrite the current state.
  const attemptSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(Date.now());
  // True once the user has made any attempt (correct or not) — decides whether
  // the session is worth recording on exit, independent of correctness.
  const attemptedRef = useRef(false);

  // Build (or regenerate) the set for the remaining daily goal. Regeneration
  // replaces the whole active set atomically only on success.
  async function loadSet(withPrompt?: string) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      // Additional learning requests the exact chosen count; a normal session
      // requests the remaining daily goal (min 1).
      const count = additionalCount ?? Math.max(remaining || 0, 1);
      const res = await recApi.sentences({ count, ...(withPrompt ? { prompt: withPrompt } : {}) });
      setItems(res.items);
      setIdx(0);
      setCorrectSet(new Set());
      setAnswered(new Set());
      setResult(null);
      setAttemptMode(null);
      setTyped("");
      setHintStage({});
      setRevealed({});
      reqIdRef.current = null;
      // Seed bookmark state from the server's saved flag on each item.
      setSaved(
        Object.fromEntries(res.items.map((s) => [s.sentence_id, !!(s.bookmarked ?? s.is_saved)])),
      );
    } catch (e) {
      if (items === null) setError(true);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Review mode: load the one saved sentence by id (never generate/replace). The
  // id is in the URL, so a refresh restores the exact same item.
  async function loadReviewItem(id: string) {
    setBusy(true);
    setError(false);
    try {
      const s = await sentenceApi.get(id);
      setItems([s]);
      setIdx(0);
      setSaved({ [s.sentence_id]: !!(s.bookmarked ?? s.is_saved) });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  // On mount, restore an in-progress session if one was saved (e.g. after a page
  // refresh) so we never regenerate content mid-session; otherwise fetch a fresh
  // set. A new set is requested only when there is nothing to resume.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    if (isReview) {
      void loadReviewItem(reviewSentenceId!);
      return;
    }
    const snap = readSessionSnapshot();
    if (snap) {
      setItems(snap.items);
      setIdx(snap.idx);
      setPoints(snap.points);
      setCorrectSet(new Set(snap.correct));
      setAnswered(new Set(snap.answered));
      setSaved(snap.saved ?? {});
      setRevealed(snap.revealed ?? {});
      setHintStage(snap.hintStage ?? {});
      setPrompt(snap.prompt ?? "");
      setKeyboard(!!snap.keyboard);
      setAdditionalCount(snap.additionalCount ?? null);
      startedAt.current = snap.startedAt ?? Date.now();
    } else {
      void loadSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the session's durable progress on every change so a refresh restores
  // it. Transient attempt state (typed text, recording, the last result) is
  // intentionally left out — a refresh resumes at the current item, clean.
  useEffect(() => {
    if (!items || isReview) return; // review restores from the URL id, not a snapshot
    const snap: SessionSnapshot = {
      items,
      idx,
      points,
      correct: [...correctSet],
      answered: [...answered],
      saved,
      revealed,
      hintStage,
      prompt,
      startedAt: startedAt.current,
      keyboard,
      additionalCount,
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(snap));
    } catch {
      /* ignore quota/serialization errors */
    }
  }, [items, idx, points, correctSet, answered, saved, revealed, hintStage, prompt, keyboard, additionalCount]);

  const total = items?.length ?? 0;
  const cur = items?.[idx];
  const progress = total ? answered.size / total : 0;
  // Note: opening/viewing a sentence does NOT count as learning. Today is only
  // credited as a learning day once the user answers a sentence correctly —
  // that happens server-side on the correct attempt, and the sun refreshes when
  // the dashboard query is invalidated on session exit.

  async function toggleSave(s: Sentence) {
    const on = saved[s.sentence_id];
    setSaved((m) => ({ ...m, [s.sentence_id]: !on }));
    try {
      if (on) await sentenceApi.unbookmark(s.sentence_id);
      else await sentenceApi.bookmark(s.sentence_id);
    } catch (e) {
      setSaved((m) => ({ ...m, [s.sentence_id]: on }));
      toast.error(errorMessage(e));
    }
  }

  function record(res: SpeechAttempt, s: Sentence, mode: AttemptMode) {
    setResult(res);
    setAttemptMode(mode);
    attemptedRef.current = true;
    // Points come from the server result; correct count from its `correct` flag.
    setPoints((p) => p + (res.points_earned ?? 0));
    if (res.correct) {
      // A correct review answer awards points server-side and creates a points
      // notification — refresh the unread badge (normal sessions do this on exit).
      if (isReview) qc.invalidateQueries({ queryKey: ["notif-unread"] });
      // Only a correct answer resolves the item and unlocks progression.
      setAnswered((a) => new Set(a).add(s.sentence_id));
      setCorrectSet((c) => new Set(c).add(s.sentence_id));
    } else {
      // Wrong answer: the item stays unresolved so the user retries in place.
      // Reset the idempotency key (so the next attempt is scored fresh, not
      // deduped to this same wrong result) and clear any typed text.
      reqIdRef.current = null;
      setTyped("");
    }
  }

  // Keyboard-mode submit. The typed text IS the full answer — the revealed hint
  // is only a placeholder cue, not a prefix that's combined in. Guards
  // empty/whitespace + duplicate/in-flight + IME composition, and funnels the
  // result into the shared feedback flow.
  async function submitTyped(s: Sentence) {
    if (submitting || composingRef.current || answered.has(s.sentence_id)) return;
    const answerText = typed.trim();
    if (!answerText) return;
    setSubmitting(true);
    reqIdRef.current ??= newRequestId();
    const seq = ++attemptSeq.current;
    try {
      const res = await sentenceApi.blankAttempt(s.sentence_id, {
        inputMode: "keyboard",
        answerText,
        clientRequestId: reqIdRef.current,
        source: attemptSource,
        reviewSessionId: isReview ? reviewSessionIdRef.current : undefined,
      });
      // Ignore a late reply that a mode switch / newer attempt has superseded.
      if (seq === attemptSeq.current) record(blankToSpeech(res), s, "keyboard");
    } catch {
      // A technical failure is not a wrong answer: keep the item, show a
      // localized retryable message, never the raw provider error.
      if (seq === attemptSeq.current) toast.error(copy.evaluationError);
    } finally {
      setSubmitting(false);
    }
  }

  // Step 1 — 힌트보기: reveal the leading character of the blank's answer
  // (server-controlled, fetched once then cached), then advance the button to
  // 정답보기. A non-blank sentence has no answer to spell out, so its hint is the
  // full romanization line shown at once. The stage only advances on success.
  async function revealHint(s: Sentence) {
    if (hintBusy || answered.has(s.sentence_id)) return; // single in-flight request
    if (hasBlank(s) && !(revealed[s.sentence_id] ?? "")) {
      setHintBusy(true);
      try {
        const res = await sentenceApi.blankHint(s.sentence_id, 0);
        setRevealed((m) => ({ ...m, [s.sentence_id]: res.revealed_text }));
      } catch (e) {
        toast.error(errorMessage(e));
        return; // finally still runs; stage is left untouched on failure
      } finally {
        setHintBusy(false);
      }
    }
    setHintStage((m) => ({ ...m, [s.sentence_id]: "hint" }));
  }

  // Step 2 — 정답보기: reveal the ENTIRE answer. For a blank the server returns the
  // whole answer (reveal_all); a non-blank already shows its full hint. The stage
  // becomes "answer", which hides the button.
  async function revealAnswer(s: Sentence) {
    if (hintBusy || answered.has(s.sentence_id)) return;
    if (hasBlank(s)) {
      setHintBusy(true);
      try {
        const res = await sentenceApi.blankHint(s.sentence_id, 0, true);
        setRevealed((m) => ({ ...m, [s.sentence_id]: res.revealed_text }));
      } catch (e) {
        toast.error(errorMessage(e));
        return;
      } finally {
        setHintBusy(false);
      }
    }
    setHintStage((m) => ({ ...m, [s.sentence_id]: "answer" }));
  }

  // The hint chip is a two-step reveal: first tap shows a hint, second (now
  // labelled 정답보기) shows the full answer and hides the chip.
  function onHint(s: Sentence) {
    if (hintStage[s.sentence_id] === "hint") void revealAnswer(s);
    else void revealHint(s);
  }

  async function startRec(s: Sentence) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setScoring(true);
        const seq = ++attemptSeq.current;
        try {
          const blob = new Blob(chunks.current, { type: "audio/webm" });
          let res: SpeechAttempt;
          if (hasBlank(s)) {
            // Voice fill-in-the-blank: accepts the missing phrase OR the full
            // completed sentence — graded server-side.
            reqIdRef.current ??= newRequestId();
            res = blankToSpeech(
              await sentenceApi.blankAttempt(s.sentence_id, {
                inputMode: "voice",
                audio: blob,
                clientRequestId: reqIdRef.current,
                source: attemptSource,
                reviewSessionId: isReview ? reviewSessionIdRef.current : undefined,
              }),
            );
          } else {
            res = await sentenceApi.speechAttempt(
              s.sentence_id,
              blob,
              "attempt.webm",
              attemptSource,
              isReview ? reviewSessionIdRef.current : undefined,
            );
          }
          // Ignore a late reply superseded by a mode switch / newer attempt.
          if (seq === attemptSeq.current) record(res, s, "voice");
        } catch {
          // A technical failure is not a wrong answer: keep the item and show a
          // localized retryable message, never the raw provider error.
          if (seq === attemptSeq.current) toast.error(copy.retryMessage);
        } finally {
          setScoring(false);
        }
      };
      media.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error(copy.micPermission);
    }
  }

  function next() {
    setResult(null);
    setAttemptMode(null);
    setTyped("");
    // The next item has its own sentence_id, so its hint stage is absent and the
    // chip resets to 힌트보기 without an explicit reset here.
    reqIdRef.current = null; // fresh idempotency key for the next item
    if (idx >= total - 1) {
      finishOrExit();
    } else {
      setIdx((i) => i + 1);
    }
  }

  // 다시 시작 — reset the single review item to its answerable state so it can be
  // reviewed again within the SAME session. `reviewSessionIdRef` is intentionally
  // NOT regenerated, so re-answering correctly is deduped server-side and never
  // awards review points a second time (only a brand-new session can).
  function reviewRestart(s: Sentence) {
    setResult(null);
    setAttemptMode(null);
    setTyped("");
    // Re-answering the SAME item: reset its hint chip to 힌트보기 and drop the
    // cached reveal so the blank starts empty again.
    setHintStage((m) => {
      const n = { ...m };
      delete n[s.sentence_id];
      return n;
    });
    setRevealed((m) => {
      const n = { ...m };
      delete n[s.sentence_id];
      return n;
    });
    reqIdRef.current = null;
    setRewardOpen(false);
    setAnswered((a) => {
      const n = new Set(a);
      n.delete(s.sentence_id);
      return n;
    });
    setCorrectSet((c) => {
      const n = new Set(c);
      n.delete(s.sentence_id);
      return n;
    });
  }

  // 다시 듣기 — replay the current sentence's audio. Overlap-safe: a re-tap stops
  // the previous playback and restarts cleanly; it never closes the sheet,
  // changes progress, or re-submits an answer.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [replaying, setReplaying] = useState(false);
  async function replayAudio(s: Sentence) {
    try {
      setReplaying(true);
      audioRef.current?.pause();
      const { url } = await sentenceApi.audio(s.sentence_id);
      const el = new Audio(url);
      audioRef.current = el;
      el.onended = () => setReplaying(false);
      el.onerror = () => {
        setReplaying(false);
        toast.error(t("session.audioError"));
      };
      await el.play();
    } catch {
      setReplaying(false);
      toast.error(t("session.audioError"));
    }
  }

  // Show the summary only if ≥1 item was correct; otherwise return via the
  // normal exit flow. Used by the CTA at completion AND the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  // Single exit path for both 완료 (modal confirm) and the back chevron. It
  // finalizes the personalized session on the server (source of truth): points
  // notification is created, and a level-up — if the server says so — routes to
  // the Level-Up screen (shown AFTER the point-reward modal the user just
  // confirmed). Single-flight so repeated taps never double-finalize.
  const finalizingRef = useRef(false);
  async function exitSession() {
    if (finalizingRef.current) return;
    // Leaving ends the session: drop its snapshot so re-entry starts fresh.
    clearSessionSnapshot();
    if (!attemptedRef.current) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav(-1);
      return;
    }
    finalizingRef.current = true;
    const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    try {
      const res = await learnApi.recordSession({
        session_type: "sentence",
        category: "conversation",
        duration_seconds,
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      qc.invalidateQueries({ queryKey: ["my-learning"] });
      if (res.leveled_up && res.level_up) {
        nav("/level-up", { replace: true, state: { levelUp: res.level_up, from } });
        return;
      }
    } catch {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    nav(-1);
  }

  const incorrect = !!result && cur != null && !result.correct;
  // The pronunciation panel is voice-only. It stays tied to the attempt history
  // (`attemptMode`) but hides while the keyboard input mode is active — switching
  // to keyboard changes the visible state without discarding the attempt.
  const showPron = incorrect && attemptMode === "voice" && !keyboard;
  // Hint chip state for the current item: undefined → 힌트보기, "hint" → 정답보기,
  // "answer" → chip hidden. A hint is shown once any stage is set.
  const curStage = cur ? hintStage[cur.sentence_id] : undefined;
  const hintShown = curStage != null;

  const panel = useMemo(
    () => (
      <div className="sess__prompt">
        <input
          className="sess__prompt-input"
          placeholder={t("session.customPlaceholder")}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label={t("session.customInputA11y")}
        />
        <button
          className="sess__prompt-send"
          onClick={() => prompt.trim() && loadSet(prompt.trim())}
          disabled={!prompt.trim() || busy}
          aria-label={t("session.customSubmitA11y")}
        >
          <img className="sess__prompt-send-ic" src={icSend} alt="" aria-hidden="true" />
        </button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt, busy],
  );

  return (
    <>
    <SessionChrome
      title={isReview ? reviewCopy.sentenceTitle : t("sessionConversation.levelTitle", { level })}
      heading={t("session.dailySentenceGoal")}
      correct={correctSet.size}
      total={total}
      progress={progress}
      panel={panel}
      minimal={isReview}
      onBack={isReview ? backToSaved : finishOrExit}
      askContext={
        !cur
          ? null
          : incorrect && result
            ? { contextKind: "speech_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
            : { contextKind: "sentence", contextId: cur.sentence_id, autoExplain: false, bubble: false }
      }
    >
      {error ? (
        <ErrorState message={t("session.sentenceLoadError")} onRetry={() => loadSet()} />
      ) : !cur ? (
        <LoadingState />
      ) : result?.correct ? (
        /* Correct-answer feedback state: interactive controls replaced by the
           completed blue card. Counter/progress already updated in record(). */
        <>
          <div className="sess__card sess__card--conv sess__card--correct">
            <div className="sess__card-top">
              <div className="sess__correct-head">
                <span className="sess__check">
                  <span className="badge-check" aria-hidden="true" />
                </span>
                <span>{t("session.correctExclaim")}</span>
              </div>
              <button className="sess__bookmark" onClick={() => toggleSave(cur)} aria-label={t(saved[cur.sentence_id] ? "sessionConversation.bookmarkUnsave" : "sessionConversation.bookmarkSave")} aria-pressed={!!saved[cur.sentence_id]}>
                {/* Group 427318316 (1718:26052) — 18 x 21.5 in the card; both states are
                    real Figma exports, so nothing here is hand-drawn. */}
                <img
                  className="sess__bookmark-ic"
                  src={saved[cur.sentence_id] ? icBookmarkOn : icBookmark}
                  alt=""
                  aria-hidden="true"
                  width={19.5}
                  height={22.25}
                />
              </button>
            </div>
            <div className="sess__sentence sess__sentence--correct" role="status" aria-label={t("session.correctA11y", { korean: cur.korean, translation: cur.translation })}>
              {cur.korean}
            </div>
            <div className="sess__trans">{cur.translation}</div>
          </div>

          <div className="sess__mic-wrap">
            {/* Item is locked once answered — no second evaluation. Stays visible
                (sharp in intermediate, blurred in complete) behind the sheet. */}
            <button className="sess__mic" disabled aria-label={t("session.alreadyDone")}>
              <img className="sess__mic-ic" src={icMic} alt="" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={`sess__card sess__card--conv ${incorrect ? "sess__card--incorrect" : ""}`}>
            <div className="sess__card-top">
              {incorrect ? (
                <div className="sess__incorrect-head" role="status">
                  <span className="sess__warn" aria-hidden="true">
                    <img className="badge-warn" src={icAlert} alt="" aria-hidden="true" />
                  </span>
                  <span>{copy.incorrectStatus}</span>
                </div>
              ) : (
                <p className="sess__instr">{t("session.fillBlank")}</p>
              )}
              <button
                className="sess__bookmark"
                onClick={() => toggleSave(cur)}
                aria-label={saved[cur.sentence_id] ? copy.bookmarkUnsave : copy.bookmarkSave}
                aria-pressed={!!saved[cur.sentence_id]}
              >
                {/* Group 427318316 (1718:26052) — 18 x 21.5 in the card; both states are
                    real Figma exports, so nothing here is hand-drawn. */}
                <img
                  className="sess__bookmark-ic"
                  src={saved[cur.sentence_id] ? icBookmarkOn : icBookmark}
                  alt=""
                  aria-hidden="true"
                  width={19.5}
                  height={22.25}
                />
              </button>
            </div>

            <FillSentence
              sentence={cur}
              keyboard={keyboard && hasBlank(cur)}
              typed={typed}
              onTyped={setTyped}
              revealed={hintShown ? (revealed[cur.sentence_id] ?? "") : ""}
              onSubmit={() => submitTyped(cur)}
              submitting={submitting}
              composingRef={composingRef}
            />
            {cur.translation && <div className="sess__trans">{cur.translation}</div>}

            {/* Non-blank sentences keep the romanization hint line; blanks reveal
                the hint inside the blank itself. */}
            {hintShown && !hasBlank(cur) && cur.romanization && (
              <p className="sess__hint">💡 {cur.romanization}</p>
            )}

            {/* Incorrect state: subtle divider below the sentence, then (voice
                only) the pronunciation feedback panel. */}
            {incorrect && <hr className="sess__divider" />}
            {showPron && result && (
              <PronunciationPanel
                score={result.pronunciation_score}
                message={pronunciationMessage(result, copy)}
                copy={copy}
              />
            )}

            <div className="sess__card-actions">
              {/* Two-step reveal: 힌트보기 → 정답보기 → hidden once the full answer is shown. */}
              {curStage !== "answer" && (
                <button
                  className={"sess__chip" + (curStage === "hint" ? " sess__chip--answer" : "")}
                  onClick={() => onHint(cur)}
                  disabled={hintBusy || answered.has(cur.sentence_id)}
                  aria-busy={hintBusy}
                >
                  <span className="sess__chip-q" aria-hidden="true">
                    <img src={icQuestion} alt="" />
                  </span>
                  {curStage === "hint" ? copy.answer : copy.hint}
                </button>
              )}
              <button
                className="sess__chip"
                onClick={() => {
                  // Switching input mode must not discard the in-flight attempt's
                  // result: bump the attempt token so a late reply is ignored,
                  // then flip the mode (same session, same item).
                  attemptSeq.current++;
                  setKeyboard((k) => !k);
                }}
                aria-pressed={keyboard}
                disabled={!hasBlank(cur)}
              >
                {/* 2689:26087 — the mode chip is label-only in Figma. */}
                {keyboard ? copy.voiceMode : copy.keyboardMode}
              </button>
            </div>
          </div>

          {/* A wrong answer never advances the session: no 다음/완료 control is
              shown. The incorrect header + (voice) pronunciation panel convey the
              result, and the same input/mic below stays available for an
              immediate retry on the current sentence. */}
          {keyboard && hasBlank(cur) ? (
            /* Keyboard mode has no separate confirm button: the answer is
               submitted by the keyboard's action key (Enter on a physical
               keyboard, Go/이동 on a mobile keyboard) — see the input's
               onKeyDown + enterKeyHint in FillSentence. */
            null
          ) : (
            <div className="sess__mic-wrap">
              {recording ? (
                <button className="sess__mic is-rec" onClick={() => media.current?.stop()} aria-label={copy.stopRecordA11y}>
                  ■
                </button>
              ) : (
                <button
                  className="sess__mic"
                  onClick={() => startRec(cur)}
                  disabled={scoring}
                  aria-label={incorrect ? copy.micRetryA11y : copy.recordA11y}
                >
                  {scoring ? <span className="spinner" style={{ width: 26, height: 26 }} /> : (
                    /* Group 33277 (673:10472) — disc, glyph and both shadows are
                       all inside this one export; nothing is redrawn here. */
                    <img className="sess__mic-ic" src={icMic} alt="" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </SessionChrome>
    {/* Correct-answer bottom sheet. Intermediate (다시 듣기 / 다음, no blur) vs
        final (다시 듣기 / 완료, blurred background). The mode is derived from the
        session's own item state, not a hardcoded count. */}
    {cur != null && result?.correct && !completed && !isReview && (
      <CorrectAnswerSheet
        mode={idx >= total - 1 ? "complete" : "next"}
        onReplay={() => replayAudio(cur)}
        onNext={next}
        onComplete={next}
        replaying={replaying}
      />
    )}
    {/* Review completion: a two-button sheet (다시 시작 / 완료), then the reward modal. */}
    {cur != null && result?.correct && isReview && !rewardOpen && (
      <ReviewCompleteSheet
        leftLabel={reviewCopy.restart}
        onLeft={() => reviewRestart(cur)}
        onComplete={() => setRewardOpen(true)}
        copy={reviewCopy}
      />
    )}
    {isReview && rewardOpen && result?.correct && (
      <ReviewRewardModal
        // The session total (accumulated across every correct attempt, kept
        // across a restart), NOT the last attempt — a deduped re-answer after a
        // restart earns 0, but the session's real total must still be shown.
        points={points}
        copy={reviewCopy}
        onConfirm={backToSaved}
      />
    )}
    {completed && !isReview && (
      <SessionCompleteModal mode="conversation" correctCount={correctSet.size} points={points} onConfirm={exitSession} />
    )}
    </>
  );
}
