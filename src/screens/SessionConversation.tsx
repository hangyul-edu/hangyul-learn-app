import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSavedReturn } from "../lib/savedReturn";
import { useTranslation } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { CorrectAnswerSheet } from "../components/CorrectAnswerSheet";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, sentenceApi, dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { errorMessage } from "../lib/http";
import { randomUuid } from "../lib/uuid";
import {
  useSessionConversationCopy,
  type SessionConversationCopy,
} from "../lib/sessionConversationCopy";
import {
  clearConversationSession,
  readConversationSession,
  saveConversationSession,
  type ConversationSessionSnapshot,
} from "../lib/conversationSessionSnapshot";
import { hasBlank } from "../components/session/FillSentence";
import {
  AnswerSentenceCard,
  SolvedSentenceCard,
} from "../components/session/ConversationCards";
import type { BlankAttempt, Sentence, SpeechAttempt } from "../lib/types";
import icSend from "../assets/brand/ic-send.svg";

/** Which input produced the last evaluated attempt — decides whether the
 * pronunciation panel (voice only) is shown. */
type AttemptMode = "keyboard" | "voice";

/** Map the fill-in-the-blank result onto the existing SpeechAttempt feedback
 * shape so the correct/incorrect/progress UI is reused unchanged. */
function blankToSpeech(blank: BlankAttempt): SpeechAttempt {
  return {
    attempt_id: blank.attempt_id,
    correct: blank.is_correct,
    transcription: blank.transcription ?? blank.normalized_answer,
    target_text: blank.completed_sentence,
    pronunciation_score: blank.is_correct ? 100 : 0,
    feedback_code: blank.is_correct ? "correct" : "missed_words",
    points_earned: blank.points_earned,
    daily_progress: blank.daily_progress ?? null,
  };
}

function newRequestId(): string {
  return randomUuid();
}

/** Actionable pronunciation feedback from the evaluation result. Prefers the
 * server's already-localized tips; falls back to a safe localized message so a
 * raw provider/API error is never surfaced to the learner. */
function pronunciationMessage(
  attempt: SpeechAttempt,
  copy: SessionConversationCopy,
): string {
  const tip = attempt.tips?.find((line) => line.trim().length > 0);
  return tip?.trim() || copy.pronunciationFallback;
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
  const startedAt = useRef(Date.now());
  // True once the user has made any attempt (correct or not) — decides whether
  // the session is worth recording on exit, independent of correctness.
  const attemptedRef = useRef(false);

  // The sentence the take was started for — bound at start, so a take is
  // always graded against the item the learner was actually reading.
  const recordingForRef = useRef<Sentence | null>(null);
  const recorder = useVoiceRecorder({
    onRecorded: (audio) => {
      const sentence = recordingForRef.current;
      if (sentence) void gradeRecording(sentence, audio);
    },
    onPermissionDenied: () => toast.error(copy.micPermission),
  });

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
        Object.fromEntries(res.items.map((s) => [s.sentence_id, !!s.bookmarked])),
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
      setSaved({ [s.sentence_id]: !!s.bookmarked });
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
    const snap = readConversationSession();
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
    const snapshot: ConversationSessionSnapshot = {
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
    saveConversationSession(snapshot);
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

  // Grade one recorded take of the current sentence. Voice fill-in-the-blank
  // accepts the missing phrase OR the full completed sentence; a sentence with
  // no blank is scored as a plain speech attempt.
  async function gradeRecording(sentence: Sentence, audio: Blob) {
    setScoring(true);
    const seq = ++attemptSeq.current;
    try {
      const attempt = hasBlank(sentence)
        ? blankToSpeech(
            await sentenceApi.blankAttempt(sentence.sentence_id, {
              inputMode: "voice",
              audio,
              clientRequestId: (reqIdRef.current ??= newRequestId()),
              source: attemptSource,
              reviewSessionId: isReview ? reviewSessionIdRef.current : undefined,
            }),
          )
        : await sentenceApi.speechAttempt(
            sentence.sentence_id,
            audio,
            "attempt.webm",
            attemptSource,
            isReview ? reviewSessionIdRef.current : undefined,
          );
      // Ignore a late reply superseded by a mode switch / newer attempt.
      if (seq === attemptSeq.current) record(attempt, sentence, "voice");
    } catch {
      // A technical failure is not a wrong answer: keep the item and show a
      // localized retryable message, never the raw provider error.
      if (seq === attemptSeq.current) toast.error(copy.retryMessage);
    } finally {
      setScoring(false);
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
  function retryItem(s: Sentence) {
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
    clearConversationSession();
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
        <SolvedSentenceCard
          sentence={cur}
          bookmark={{ saved: !!saved[cur.sentence_id], onToggle: () => toggleSave(cur) }}
        />
      ) : (
        <AnswerSentenceCard
          sentence={cur}
          copy={copy}
          incorrect={incorrect}
          bookmark={{ saved: !!saved[cur.sentence_id], onToggle: () => toggleSave(cur) }}
          revealedText={hintShown ? (revealed[cur.sentence_id] ?? "") : ""}
          pronunciation={
            showPron && result
              ? {
                  score: result.pronunciation_score,
                  message: pronunciationMessage(result, copy),
                }
              : null
          }
          hint={{
            stage: curStage,
            busy: hintBusy,
            disabled: answered.has(cur.sentence_id),
            onReveal: () => onHint(cur),
          }}
          answer={{
            keyboard,
            onToggleKeyboard: () => {
              // Switching input mode must not discard the in-flight attempt's
              // result: bump the attempt token so a late reply is ignored,
              // then flip the mode (same session, same item).
              attemptSeq.current++;
              setKeyboard((on) => !on);
            },
            typed,
            onTyped: setTyped,
            onSubmit: () => submitTyped(cur),
            submitting,
            composingRef,
          }}
          voice={{
            recording: recorder.recording,
            scoring,
            onStart: () => {
              recordingForRef.current = cur;
              void recorder.start();
            },
            onStop: recorder.stop,
          }}
        />
      )}
    </SessionChrome>
    {/* Correct-answer bottom sheet. Intermediate (다시 시작 / 다음, no blur) vs
        final (다시 시작 / 완료, blurred background). The mode is derived from the
        session's own item state, not a hardcoded count. The left tile re-arms
        this item — the same action the review sheet runs — never audio replay. */}
    {cur != null && result?.correct && !completed && !isReview && (
      <CorrectAnswerSheet
        mode={idx >= total - 1 ? "complete" : "next"}
        onRetry={() => retryItem(cur)}
        onNext={next}
        onComplete={next}
      />
    )}
    {/* Review completion: a two-button sheet (다시 시작 / 완료), then the reward modal. */}
    {cur != null && result?.correct && isReview && !rewardOpen && (
      <ReviewCompleteSheet
        leftLabel={reviewCopy.restart}
        onLeft={() => retryItem(cur)}
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
