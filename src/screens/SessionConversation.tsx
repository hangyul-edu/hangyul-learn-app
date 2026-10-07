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
import { recApi, sentenceApi, dashboardApi, learnApi, studyApi } from "../api/endpoints";
import {
  activityToSentence,
  answeredCorrectly,
  isApiCode,
  isOpenActivity,
  isStudyItem,
  practiceSentenceCorrect,
  revealedBlankAnswer,
  revealedKorean,
  sentenceKey,
  studyToSpeech,
  visibleActivities,
  type StudySentence,
} from "../lib/studySession";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { errorMessage } from "../lib/http";
import { needsRetake, speechErrorMessage, type RecordingInfo } from "../lib/recording";
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
import type { BlankAttempt, Sentence, SpeechAttempt, StudyAttemptResult, StudySession } from "../lib/types";
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
  return { remaining, level: t?.level ?? 1, ready: q.isFetched };
}

/** The most activities one adaptive session plans (server limit). */
const MAX_SESSION_ACTIVITIES = 20;

export function SessionConversation() {
  const { t, language } = useTranslation();
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
  const navState = loc.state as { from?: string; additionalCount?: number } | null;
  const { remaining, level, ready } = useRemaining();
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
  // preserved across `retryItem` — so re-answering the same item after a
  // 다시 시작 collides on the key server-side and is not re-awarded.
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
  // The adaptive session behind this set (reviewed content, graded on the
  // server, customizable, with the grounded tutor). Null when the set came
  // from the legacy recommender — the fallback when no reviewed content fits.
  const [study, setStudy] = useState<{ sessionId: string; revision: number } | null>(null);
  // Items whose server activity is closed (answered, or out of tries): a
  // re-answer is practice, checked locally against the revealed key and never
  // credited. `missed` = closed without a correct answer (never counted correct).
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());
  // True once the user has made any attempt (correct or not) — decides whether
  // the session is worth recording on exit, independent of correctness.
  const attemptedRef = useRef(false);

  // The sentence the take was started for — bound at start, so a take is
  // always graded against the item the learner was actually reading.
  const recordingForRef = useRef<Sentence | null>(null);
  const recorder = useVoiceRecorder({
    onRecorded: (audio, take) => {
      const sentence = recordingForRef.current;
      if (sentence) void gradeRecording(sentence, audio, take);
    },
    onUnavailable: () => toast.error(copy.micPermission),
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

  // Show an adaptive session through the existing screen state. Item progress
  // (resolved / correct / closed) is the server's; UI-only state (hints shown,
  // bookmarks, points) is left alone. The current item stays current when it is
  // still in the plan (e.g. after a customization), else the first open one.
  function applySession(s: StudySession, keepActivityId?: string) {
    const acts = visibleActivities(s);
    const resolved = acts.filter((a) => !isOpenActivity(a));
    setStudy({ sessionId: s.session_id, revision: s.current_revision });
    setItems(acts.map((a) => activityToSentence(a, s.learner_band)));
    setAnswered(new Set(resolved.map(sentenceKey)));
    setCorrectSet(new Set(acts.filter(answeredCorrectly).map(sentenceKey)));
    setClosed(new Set(resolved.map(sentenceKey)));
    setMissed(new Set(resolved.filter((a) => !answeredCorrectly(a)).map(sentenceKey)));
    const kept = keepActivityId ? acts.findIndex((a) => a.activity_id === keepActivityId) : -1;
    const firstOpen = acts.findIndex(isOpenActivity);
    setIdx(kept >= 0 ? kept : firstOpen >= 0 ? firstOpen : 0);
    if (kept < 0) {
      setResult(null);
      setAttemptMode(null);
      setTyped("");
      reqIdRef.current = null;
    }
  }

  // Start the adaptive session — or resume the active one — for the remaining
  // daily goal (additional learning: the chosen batch). A resumed session with
  // nothing left open is finished and a fresh one started.
  async function startStudy(): Promise<StudySession> {
    const count = additionalCount ?? (remaining || undefined);
    const body = {
      track: "conversation" as const,
      explanation_language: (language === "ko" ? "ko" : "en") as "ko" | "en",
      ...(count ? { activity_count: Math.min(count, MAX_SESSION_ACTIVITIES) } : {}),
    };
    let s = await studyApi.start({ ...body, client_request_id: randomUuid() });
    if (!visibleActivities(s).some(isOpenActivity)) {
      await studyApi.complete(s.session_id).catch(() => studyApi.abandon(s.session_id));
      s = await studyApi.start({ ...body, client_request_id: randomUuid() });
    }
    return s;
  }

  async function bootStudy(snap: ConversationSessionSnapshot | null) {
    setBusy(true);
    setError(false);
    try {
      const s = await startStudy();
      if (snap && snap.studySessionId === s.session_id) {
        // Same session after a refresh: keep what only this screen knows.
        setPoints(snap.points);
        setSaved(snap.saved ?? {});
        setRevealed(snap.revealed ?? {});
        setHintStage(snap.hintStage ?? {});
        setPrompt(snap.prompt ?? "");
        setKeyboard(!!snap.keyboard);
        setAdditionalCount(snap.additionalCount ?? null);
        startedAt.current = snap.startedAt ?? Date.now();
      }
      applySession(s);
      if (s.shortfall_message) toast.show(language === "ko" ? s.shortfall_message.ko : s.shortfall_message.en);
    } catch (e) {
      if (isApiCode(e, "session.no_eligible_content")) {
        // Nothing reviewed fits this level yet: fall back to the recommender.
        setBusy(false);
        await loadSet();
        return;
      }
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  // On mount, resume: the adaptive session is resumed from the server (the
  // snapshot only restores this screen's own UI state); a saved legacy set is
  // restored from the snapshot. A new set is requested only when there is
  // nothing to resume. Waits for the dashboard, which sizes the set.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    if (isReview) {
      bootedRef.current = true;
      void loadReviewItem(reviewSentenceId!);
      return;
    }
    const snap = readConversationSession();
    if (snap && !snap.studySessionId) {
      bootedRef.current = true;
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
      return;
    }
    if (!ready) return;
    bootedRef.current = true;
    void bootStudy(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Record that the current activity is on screen (exposure for the
  // repetition policy). Idempotent server-side.
  const curActivityId = isStudyItem(items?.[idx]) ? (items![idx] as StudySentence).activity_id : null;
  useEffect(() => {
    if (study && curActivityId) void studyApi.present(study.sessionId, curActivityId).catch(() => undefined);
  }, [study, curActivityId]);

  // Natural-language customization of the rest of the adaptive session, from
  // the existing prompt panel. Honest outcome: applied / asks back / unchanged.
  async function customize(text: string) {
    if (!study) {
      void loadSet(text);
      return;
    }
    if (busy) return;
    setBusy(true);
    const keep = isStudyItem(cur) ? cur.activity_id : undefined;
    try {
      const res = await studyApi.customize(study.sessionId, {
        prompt: text,
        expected_revision: study.revision,
        client_request_id: randomUuid(),
      });
      const msg = res.message ? (language === "ko" ? res.message.ko : res.message.en) : null;
      if (res.status === "applied") {
        applySession(res.session, keep);
        toast.success(msg ?? t("session.customApplied"));
      } else if (res.status === "conflicted") {
        applySession(res.session, keep);
        toast.show(msg ?? t("session.customConflict"));
      } else if (msg) {
        toast.show(msg);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function updateStudyItem(activityId: string, patch: Partial<StudySentence>) {
    setItems((list) =>
      list ? list.map((it) => (isStudyItem(it) && it.activity_id === activityId ? { ...it, ...patch } : it)) : list,
    );
  }

  // A server verdict on an adaptive activity, funnelled into the shared
  // feedback flow. Out of tries: the answer is shown in the blank and the
  // learner types it to move on (practice, not credited).
  function onStudyResult(res: StudyAttemptResult, s: StudySentence, mode: AttemptMode, typedText: string) {
    const key = s.sentence_id;
    if (res.reveal) updateStudyItem(s.activity_id, { reveal: res.reveal, korean: revealedKorean(res.reveal) ?? s.korean });
    const closedNow = !["pending", "presented", "attempted"].includes(res.activity_status);
    if (closedNow) setClosed((c) => new Set(c).add(key));
    if (!res.correct && closedNow) {
      setMissed((m) => new Set(m).add(key));
      setRevealed((m) => ({ ...m, [key]: revealedBlankAnswer(res.reveal) }));
      setHintStage((m) => ({ ...m, [key]: "answer" }));
      setKeyboard(true);
      toast.show(t("session.answerShownAfterTries"));
    }
    record(studyToSpeech(res, s.activity_id, typedText), s, mode);
  }

  // An ended session (idle expiry) takes no answers, hints or reveals: start a
  // fresh one.
  function recoverStudy(e: unknown): boolean {
    if (!isApiCode(e, "session.not_active")) return false;
    void bootStudy(null);
    return true;
  }

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
      studySessionId: study?.sessionId ?? null,
    };
    saveConversationSession(snapshot);
  }, [items, idx, points, correctSet, answered, saved, revealed, hintStage, prompt, keyboard, additionalCount, study]);

  const total = items?.length ?? 0;
  const cur = items?.[idx];
  const progress = total ? answered.size / total : 0;
  // A sentence on screen counts as study: displaying it records today's
  // learning activity (streak + learning day + the sun), once per local day and
  // silently — no answer needed. A correct answer additionally feeds the goal,
  // points and the conversation count through the attempt endpoints. Nothing
  // is recorded while loading or on the error state (no sentence shown).
  useRecordDisplayedItem("conversation", error ? null : cur?.sentence_id);

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
      // Only a correct answer resolves the item and unlocks progression. An
      // item that ran out of tries is resolved but never counted as correct.
      setAnswered((a) => new Set(a).add(s.sentence_id));
      if (!missed.has(s.sentence_id)) setCorrectSet((c) => new Set(c).add(s.sentence_id));
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
    if (isStudyItem(s) && closed.has(s.sentence_id)) {
      // Practice re-answer of a closed activity: checked locally, not recorded.
      const ok = practiceSentenceCorrect(s.reveal, answerText);
      record(
        {
          attempt_id: `${s.activity_id}:practice`,
          correct: ok,
          transcription: answerText,
          target_text: s.korean,
          pronunciation_score: ok ? 100 : 0,
          feedback_code: ok ? "correct" : "missed_words",
          points_earned: 0,
        },
        s,
        "keyboard",
      );
      return;
    }
    setSubmitting(true);
    reqIdRef.current ??= newRequestId();
    const seq = ++attemptSeq.current;
    if (isStudyItem(s) && study) {
      try {
        const res = await studyApi.attempt(study.sessionId, s.activity_id, {
          answer: answerText,
          client_request_id: reqIdRef.current,
        });
        if (seq === attemptSeq.current) onStudyResult(res, s, "keyboard", answerText);
      } catch (e) {
        if (seq === attemptSeq.current && !recoverStudy(e)) toast.error(copy.evaluationError);
      } finally {
        setSubmitting(false);
      }
      return;
    }
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
        // A session activity's hint is counted on the server (a hinted answer
        // is weaker evidence); a closed one's comes from the revealed key.
        const text = isStudyItem(s)
          ? closed.has(s.sentence_id)
            ? revealedBlankAnswer(s.reveal).slice(0, 1)
            : ((await studyApi.hint(study!.sessionId, s.activity_id)).revealed_text ?? "")
          : (await sentenceApi.blankHint(s.sentence_id, 0)).revealed_text;
        setRevealed((m) => ({ ...m, [s.sentence_id]: text }));
      } catch (e) {
        if (!recoverStudy(e)) toast.error(errorMessage(e));
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
        let text: string;
        if (isStudyItem(s)) {
          // Revealing on the server means a later correct answer is not
          // counted as independent evidence and earns no credit.
          const reveal = closed.has(s.sentence_id) ? s.reveal : await studyApi.reveal(study!.sessionId, s.activity_id);
          if (reveal && reveal !== s.reveal) updateStudyItem(s.activity_id, { reveal, korean: revealedKorean(reveal) ?? s.korean });
          text = revealedBlankAnswer(reveal);
        } else {
          text = (await sentenceApi.blankHint(s.sentence_id, 0, true)).revealed_text;
        }
        setRevealed((m) => ({ ...m, [s.sentence_id]: text }));
      } catch (e) {
        if (!recoverStudy(e)) toast.error(errorMessage(e));
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
  async function gradeRecording(sentence: Sentence, audio: Blob, take: RecordingInfo) {
    if (isStudyItem(sentence) && study) {
      // A closed activity takes no more graded answers; practice is typed.
      if (closed.has(sentence.sentence_id)) {
        setKeyboard(true);
        return;
      }
      setScoring(true);
      const seq = ++attemptSeq.current;
      try {
        const res = await studyApi.voiceAttempt(
          study.sessionId,
          sentence.activity_id,
          audio,
          take,
          (reqIdRef.current ??= newRequestId()),
        );
        if (seq === attemptSeq.current) onStudyResult(res, sentence, "voice", res.transcription ?? "");
      } catch (e) {
        if (seq === attemptSeq.current && !recoverStudy(e)) {
          // Silence / an unreadable take was not graded: say why, record again.
          toast.error(needsRetake(e) ? speechErrorMessage(e) : copy.retryMessage);
        }
      } finally {
        setScoring(false);
      }
      return;
    }
    setScoring(true);
    const seq = ++attemptSeq.current;
    try {
      const attempt = hasBlank(sentence)
        ? blankToSpeech(
            await sentenceApi.blankAttempt(sentence.sentence_id, {
              inputMode: "voice",
              audio,
              take,
              clientRequestId: (reqIdRef.current ??= newRequestId()),
              source: attemptSource,
              reviewSessionId: isReview ? reviewSessionIdRef.current : undefined,
            }),
          )
        : await sentenceApi.speechAttempt(
            sentence.sentence_id,
            audio,
            take,
            attemptSource,
            isReview ? reviewSessionIdRef.current : undefined,
          );
      // Ignore a late reply superseded by a mode switch / newer attempt.
      if (seq === attemptSeq.current) record(attempt, sentence, "voice");
    } catch (e) {
      // A technical failure is not a wrong answer: keep the item and show a
      // localized retryable message, never the raw provider error. Silence or
      // an unreadable take gets its own line, so the learner knows to retake.
      if (seq === attemptSeq.current) toast.error(needsRetake(e) ? speechErrorMessage(e) : copy.retryMessage);
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
  // records the personalized session on the server (source of truth) and the
  // points notification is created. Finishing a session never changes a level —
  // levels come only from the server's proficiency assessments. Single-flight
  // so repeated taps never double-record.
  const finalizingRef = useRef(false);
  async function exitSession() {
    if (finalizingRef.current) return;
    // Leaving ends the session: drop its snapshot so re-entry starts fresh.
    clearConversationSession();
    if (study) {
      // Completed when every activity is resolved, otherwise ended early.
      const id = study.sessionId;
      void studyApi.complete(id).catch(() => studyApi.abandon(id).catch(() => undefined));
    }
    if (!attemptedRef.current) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav(-1);
      return;
    }
    finalizingRef.current = true;
    const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    try {
      await learnApi.recordSession({
        session_type: "sentence",
        category: "conversation",
        duration_seconds,
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      qc.invalidateQueries({ queryKey: ["management"] });
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
          onClick={() => prompt.trim() && customize(prompt.trim())}
          disabled={!prompt.trim() || busy}
          aria-label={t("session.customSubmitA11y")}
        >
          <img className="sess__prompt-send-ic" src={icSend} alt="" aria-hidden="true" />
        </button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt, busy, study, idx, items],
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
          : isStudyItem(cur) && study
            ? // The grounded tutor: hints while the item is open, explanations after.
              { contextKind: "study_activity", sessionId: study.sessionId, contextId: cur.activity_id, autoExplain: incorrect, bubble: incorrect }
          : incorrect && result
            ? { contextKind: "speech_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
            : { contextKind: "sentence", contextId: cur.sentence_id, autoExplain: false, bubble: false }
      }
    >
      {error ? (
        <ErrorState message={t("session.sentenceLoadError")} onRetry={() => void bootStudy(null)} />
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
