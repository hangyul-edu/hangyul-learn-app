import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { recApi, sentenceApi, studyApi, speechApi } from "../../api/endpoints";
import { hasBlank } from "../../components/session/FillSentence";
import { useToast } from "../../hooks/toast";
import { useRecordDisplayedItem } from "../../hooks/learningActivity";
import {
  startStudySession,
  useBookmarks,
  useExitSession,
  usePresentActivity,
  useTrackGoal,
  type StudyRef,
} from "../../hooks/studySessionFlow";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import type { SpokenTake } from "../../lib/speech";
import {
  clearConversationSession,
  readConversationSession,
  saveConversationSession,
  type ConversationSessionSnapshot,
} from "../../lib/conversationSessionSnapshot";
import { errorMessage } from "../../lib/http";
import { needsRetake, speechErrorMessage } from "../../lib/recording";
import { resolveMessage } from "../../i18n/current";
import { useSavedReturn } from "../../lib/savedReturn";
import { useSessionConversationCopy } from "../../lib/sessionConversationCopy";
import {
  activityToSentence,
  answeredCorrectly,
  explanationLanguage,
  isApiCode,
  isClosedStatus,
  isOpenActivity,
  isStudyItem,
  localizedMessage,
  practiceSentenceCorrect,
  revealedBlankAnswer,
  revealedKorean,
  sentenceKey,
  studyToSpeech,
  visibleActivities,
  type StudySentence,
} from "../../lib/studySession";
import type { Sentence, SpeechAttempt, StudyAttemptResult, StudySession } from "../../lib/types";
import { randomUuid } from "../../lib/uuid";
import { withKey, withoutEntry, withoutKey } from "../../lib/collections";
import { isSubscriptionRequired } from "../../hooks/premiumLecture";
import { blankToSpeech, type AttemptMode, type HintStage } from "./attempts";

/**
 * The conversation session's state machine: the set (adaptive session, or the
 * legacy recommender as the fallback), answering by voice or keyboard, the
 * two-step hint, bookmarks, the refresh snapshot and the exit.
 *
 * Single-item review mode — reached via /review/sentence/:sentenceId — reuses
 * the whole answer flow with one fixed saved sentence: source="review" attempts
 * (the server awards review points, skips goal/level), no progress/config
 * chrome, and a review completion sheet + reward modal instead of the summary.
 */
export function useConversationSession() {
  const { t, language } = useTranslation();
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  const copy = useSessionConversationCopy();
  const { sentenceId: reviewSentenceId } = useParams();
  const isReview = !!reviewSentenceId;
  // Used only in review mode: back / 확인 return to the saved-learning category
  // this session was opened from (see SessionReview for the mirror case).
  const backToSaved = useSavedReturn("sentence");
  const [rewardOpen, setRewardOpen] = useState(false);
  const attemptSource = isReview ? "review" : "custom";
  const navState = loc.state as { from?: string; additionalCount?: number } | null;
  const { remaining, level, ready } = useTrackGoal("conversation");
  // Additional-learning batch size (5/10/15/20), set only when the user opted
  // into extra study after completing today's goal; null for a normal session.
  const [additionalCount, setAdditionalCount] = useState<number | null>(navState?.additionalCount ?? null);

  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Sentence[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const { saved, setSaved, toggle: toggleSaved } = useBookmarks(sentenceApi);
  // Per-sentence hint stage. Absent = untouched (button reads 힌트보기); "hint" =
  // one leading character revealed (button becomes 정답보기); "answer" = the whole
  // answer revealed (button hidden). Keyed by sentence_id so each item is
  // independent and advancing to the next item resets the button automatically.
  const [hintStage, setHintStage] = useState<Record<string, HintStage>>({});
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
  // The review item is a premium lecture's, refused without premium access.
  const [locked, setLocked] = useState(false);
  // The adaptive session behind this set (reviewed content, graded on the
  // server, customizable, with the grounded tutor). Null when the set came
  // from the legacy recommender — the fallback when no reviewed content fits.
  const [study, setStudy] = useState<StudyRef | null>(null);
  // Items whose server activity is closed (answered, or out of tries): a
  // re-answer is practice, checked locally against the revealed key and never
  // credited. `missed` = closed without a correct answer (never counted correct).
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());
  // True once the user has made any attempt (correct or not) — decides whether
  // the session is worth recording on exit, independent of correctness.
  const attemptedRef = useRef(false);
  const exit = useExitSession("conversation", clearConversationSession);

  // The sentence the take was started for — bound at start, so a take is
  // always graded against the item the learner was actually reading.
  const recordingForRef = useRef<Sentence | null>(null);
  const recorder = useSpeechInput({
    purpose: "sentence",
    context: { source: attemptSource },
    onSpoken: (spoken) => {
      const sentence = recordingForRef.current;
      if (sentence) void gradeRecording(sentence, spoken);
    },
    // A live take in which the agent heard nothing: the same line the server
    // sends for a silent recording, and no attempt.
    onNothingHeard: () => toast.error(resolveMessage("speechError.noSpeech")),
    // Heard but not transcribed: a technical failure, not a wrong answer.
    onFailed: () => toast.error(copy.evaluationError),
    onUnavailable: () => toast.error(copy.micPermission),
  });

  /** Drop the current attempt: no verdict shown, nothing typed, and a fresh
   * idempotency key for the next one. */
  function clearAttempt() {
    setResult(null);
    setAttemptMode(null);
    setTyped("");
    reqIdRef.current = null;
  }

  /** What only this screen knows about a session, back from its snapshot. */
  function restoreScreenState(snap: ConversationSessionSnapshot) {
    setPoints(snap.points);
    setSaved(snap.saved ?? {});
    setRevealed(snap.revealed ?? {});
    setHintStage(snap.hintStage ?? {});
    setPrompt(snap.prompt ?? "");
    setKeyboard(!!snap.keyboard);
    setAdditionalCount(snap.additionalCount ?? null);
    startedAt.current = snap.startedAt ?? Date.now();
  }

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
      clearAttempt();
      setHintStage({});
      setRevealed({});
      // Seed bookmark state from the server's saved flag on each item.
      setSaved(Object.fromEntries(res.items.map((s) => [s.sentence_id, !!s.bookmarked])));
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
    } catch (e) {
      // A premium lecture's checkpoint sentence without premium access (saved
      // during a trial, or a link): the screen leaves with the notice instead.
      if (isSubscriptionRequired(e)) setLocked(true);
      else setError(true);
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
    if (kept < 0) clearAttempt();
  }

  // Start the adaptive session — or resume the active one — for the remaining
  // daily goal (additional learning: the chosen batch).
  async function bootStudy(snap: ConversationSessionSnapshot | null) {
    setBusy(true);
    setError(false);
    try {
      const s = await startStudySession(
        { track: "conversation", explanation_language: explanationLanguage(language) },
        additionalCount ?? (remaining || undefined),
      );
      // Same session after a refresh: keep what only this screen knows.
      if (snap && snap.studySessionId === s.session_id) restoreScreenState(snap);
      applySession(s);
      if (s.shortfall_message) toast.show(localizedMessage(s.shortfall_message, language));
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
      setCorrectSet(new Set(snap.correct));
      setAnswered(new Set(snap.answered));
      restoreScreenState(snap);
      return;
    }
    if (!ready) return;
    bootedRef.current = true;
    void bootStudy(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const total = items?.length ?? 0;
  const cur = items?.[idx];

  usePresentActivity(study, isStudyItem(cur) ? cur.activity_id : null);

  // Natural-language customization of the rest of the adaptive session, from
  // the prompt panel. Honest outcome: applied / asks back / unchanged.
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
      const msg = res.message ? localizedMessage(res.message, language) : null;
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
    const closedNow = isClosedStatus(res.activity_status);
    if (closedNow) setClosed((c) => withKey(c, key));
    if (!res.correct && closedNow) {
      // The answer is shown; the learner practises it in whichever input
      // mode they are in — spoken practice is checked on the device too.
      setMissed((m) => withKey(m, key));
      setRevealed((m) => ({ ...m, [key]: revealedBlankAnswer(res.reveal) }));
      setHintStage((m) => ({ ...m, [key]: "answer" }));
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
    saveConversationSession({
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
    });
  }, [items, idx, points, correctSet, answered, saved, revealed, hintStage, prompt, keyboard, additionalCount, study, isReview]);

  // A sentence on screen counts as study: displaying it records today's
  // learning activity (streak + learning day + the sun), once per local day and
  // silently — no answer needed. A correct answer additionally feeds the goal,
  // points and the conversation count through the attempt endpoints. Nothing
  // is recorded while loading or on the error state (no sentence shown).
  useRecordDisplayedItem("conversation", error ? null : cur?.sentence_id);

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
      setAnswered((a) => withKey(a, s.sentence_id));
      if (!missed.has(s.sentence_id)) setCorrectSet((c) => withKey(c, s.sentence_id));
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
    reqIdRef.current ??= randomUuid();
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
  async function gradeRecording(sentence: Sentence, spoken: SpokenTake) {
    // What goes to the server: the live transcript's id, or the recording.
    const heard = spoken.transcript ?? spoken.audio;
    if (isStudyItem(sentence) && study) {
      // A closed activity takes no more graded answers: a spoken re-answer is
      // practice, checked on the device against the revealed key, never credited.
      if (closed.has(sentence.sentence_id)) {
        await practiceByVoice(sentence, spoken);
        return;
      }
      setScoring(true);
      const seq = ++attemptSeq.current;
      try {
        const res = await studyApi.voiceAttempt(
          study.sessionId,
          sentence.activity_id,
          heard,
          spoken.take,
          (reqIdRef.current ??= randomUuid()),
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
              audio: spoken.audio,
              take: spoken.take,
              transcript: spoken.transcript,
              clientRequestId: (reqIdRef.current ??= randomUuid()),
              source: attemptSource,
              reviewSessionId: isReview ? reviewSessionIdRef.current : undefined,
            }),
          )
        : await sentenceApi.speechAttempt(
            sentence.sentence_id,
            heard,
            spoken.take,
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

  /** Spoken practice of a closed activity: what was heard, checked locally like typed practice. */
  async function practiceByVoice(sentence: StudySentence, spoken: SpokenTake) {
    setScoring(true);
    const seq = ++attemptSeq.current;
    try {
      const heardText = spoken.transcript
        ? spoken.transcript.text
        : (await speechApi.transcribe(spoken.audio, spoken.take)).text;
      if (seq !== attemptSeq.current) return;
      if (!heardText.trim()) {
        toast.error(resolveMessage("speechError.noSpeech"));
        return;
      }
      const ok = practiceSentenceCorrect(sentence.reveal, heardText);
      record(
        {
          attempt_id: `${sentence.activity_id}:practice`,
          correct: ok,
          transcription: heardText,
          target_text: sentence.korean,
          pronunciation_score: ok ? 100 : 0,
          feedback_code: ok ? "correct" : "missed_words",
          points_earned: 0,
        },
        sentence,
        "voice",
      );
    } catch (e) {
      if (seq === attemptSeq.current) toast.error(needsRetake(e) ? speechErrorMessage(e) : copy.retryMessage);
    } finally {
      setScoring(false);
    }
  }

  function next() {
    // The next item has its own sentence_id, so its hint stage is absent and the
    // chip resets to 힌트보기 without an explicit reset here.
    clearAttempt();
    if (idx >= total - 1) finishOrExit();
    else setIdx((i) => i + 1);
  }

  // 다시 시작 — reset the single review item to its answerable state so it can be
  // reviewed again within the SAME session. `reviewSessionIdRef` is intentionally
  // NOT regenerated, so re-answering correctly is deduped server-side and never
  // awards review points a second time (only a brand-new session can).
  function retryItem(s: Sentence) {
    clearAttempt();
    // Re-answering the SAME item: reset its hint chip to 힌트보기 and drop the
    // cached reveal so the blank starts empty again.
    setHintStage((m) => withoutEntry(m, s.sentence_id));
    setRevealed((m) => withoutEntry(m, s.sentence_id));
    setRewardOpen(false);
    setAnswered((a) => withoutKey(a, s.sentence_id));
    setCorrectSet((c) => withoutKey(c, s.sentence_id));
  }

  // Show the summary only if ≥1 item was correct; otherwise return via the
  // normal exit flow. Used by the CTA at completion AND the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  function exitSession() {
    return exit({ study, attempted: attemptedRef.current, startedAt: startedAt.current });
  }

  // Switching input mode must not discard the in-flight attempt's result: bump
  // the attempt token so a late reply is ignored, then flip the mode (same
  // session, same item).
  function toggleKeyboard() {
    attemptSeq.current++;
    setKeyboard((on) => !on);
  }

  function startVoice(s: Sentence) {
    recordingForRef.current = s;
    void recorder.start();
  }

  return {
    copy,
    isReview,
    locked,
    level,
    study,
    cur,
    idx,
    total,
    // Progress counts resolved items, not only correct ones.
    progress: total ? answered.size / total : 0,
    /** Items still open: leaving asks first (cp_G_01_modals 1:5529). */
    hasRemaining: total > 0 && answered.size < total,
    correctCount: correctSet.size,
    points,
    completed,
    error,
    busy,
    result,
    attemptMode,
    answered,
    saved,
    revealed,
    hintStage,
    hintBusy,
    keyboard,
    typed,
    submitting,
    scoring,
    composingRef,
    recording: recorder.recording,
    stopVoice: recorder.stop,
    prompt,
    setPrompt,
    setTyped,
    rewardOpen,
    setRewardOpen,
    toggleSave: (s: Sentence) => toggleSaved(s.sentence_id),
    customize,
    submitTyped,
    onHint,
    startVoice,
    toggleKeyboard,
    next,
    retryItem,
    finishOrExit,
    exitSession,
    backToSaved,
    // Review mode retries the same saved sentence, never a new session.
    retryLoad: () => void (isReview ? loadReviewItem(reviewSentenceId!) : bootStudy(null)),
  };
}
