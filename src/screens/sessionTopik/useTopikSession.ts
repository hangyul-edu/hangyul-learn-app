import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../../i18n";
import { quizApi, recApi, studyApi } from "../../api/endpoints";
import { quizAttemptBody, type AnswerValue } from "../../components/QuestionView";
import { canSubmitTopik } from "../../components/topik/TopikQuestion";
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
import { withKey, withoutEntry } from "../../lib/collections";
import { errorMessage } from "../../lib/http";
import {
  activityToQuiz,
  answeredCorrectly,
  explanationLanguage,
  isApiCode,
  isClosedStatus,
  isOpenActivity,
  isStudyItem,
  localizedMessage,
  quizKey,
  revealedChoiceKey,
  studyToQuizResult,
  visibleActivities,
  type StudyQuiz,
} from "../../lib/studySession";
import {
  clearTopikSession,
  readTopikSession,
  saveTopikSession,
  type TopikSessionSnapshot,
} from "../../lib/topikSessionSnapshot";
import type { Quiz, QuizAttemptResult, StudySession, TopikSection } from "../../lib/types";
import { randomUuid } from "../../lib/uuid";

/**
 * Explicit per-question answer phase. The whole result/retry/next flow is
 * driven by this — never inferred from unrelated values (progress, whether a
 * result object exists, the selected option). Transitions:
 *   answering  → submitting            (Submit pressed with a valid answer)
 *   submitting → incorrect | correct   (server verdict)
 *   incorrect  → answering             (learner selects a different option)
 *   incorrect  → submitting            (Submit pressed again, same question)
 *   correct    → (Next → new question, phase resets to answering)
 *   submitting → revealed              (adaptive session: the second wrong
 *                                        answer closes the item; the correct
 *                                        option is shown and Next is offered)
 */
export type Phase = "answering" | "submitting" | "incorrect" | "correct" | "revealed";

/** A submitted answer is a retryable wrong answer only for graded selection
 * questions (MC / fill-blanks). Writing is scored, never right/wrong, so it is
 * terminal (→ Next) regardless. */
function isRetryableWrong(result: QuizAttemptResult): boolean {
  if (result.writing) return false;
  if (result.status === "submitted") return false; // deferred writing grade
  return result.correct === false;
}

/** `keys` with `key` appended once (the wrong options tried on a question). */
function withWrongKey(keys: string[], key: string | undefined): string[] {
  return !key || keys.includes(key) ? keys : [...keys, key];
}

/**
 * The TOPIK session's state machine: the set for the chosen part (adaptive
 * session for listening/reading, the legacy recommender for writing or when no
 * reviewed content fits), the per-question answer phase, the server-confirmed
 * daily progress, the refresh snapshot, 다시 풀기 and the exit.
 */
export function useTopikSession() {
  const { t, language } = useTranslation();
  const loc = useLocation();
  const toast = useToast();
  const navState = loc.state as { from?: string; section?: TopikSection; additionalCount?: number } | null;
  // The TOPIK part chosen in the part-selection modal drives the question-type
  // dropdown and generation; it's fixed for the whole session. Fall back to
  // listening only if the screen is reached without a selection (deep link).
  const section: TopikSection = navState?.section ?? "listening";

  const { track: topik, level: grade, remaining, ready } = useTrackGoal("topik");
  const types = useQuery({
    queryKey: ["topik-question-types", section],
    queryFn: () => recApi.topikQuestionTypes(section),
  });
  const [typesOpen, setTypesOpen] = useState(false);

  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [items, setItems] = useState<Quiz[] | null>(null);
  const [idx, setIdx] = useState(0);
  // Working answers keyed by quiz_id. The current item's answer is derived from
  // this map, so navigating between items and refreshing both preserve drafts.
  const [drafts, setDrafts] = useState<Record<string, AnswerValue>>({});
  // Explicit answer phase for the CURRENT question (see Phase).
  const [phase, setPhase] = useState<Phase>("answering");
  // The graded response for the current question (banner + wrong option + AI).
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  // Option keys submitted and confirmed wrong for the CURRENT question — kept
  // red so the learner sees which attempts failed while retrying.
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  // The exact answer value last submitted (any format); Submit stays disabled
  // until the learner changes it, so an identical resubmit isn't offered.
  const [submittedValue, setSubmittedValue] = useState<AnswerValue | null>(null);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());
  // Quiz_ids the learner has attempted at all (right or wrong) — used only to
  // decide whether to record session time on exit, never for progress.
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  // True while re-solving the set after 다시 시작. The daily goal is already met,
  // so completion is driven by finishing all items (not the goal) — otherwise the
  // met goal would end the retry after the first answer.
  const [retrying, setRetrying] = useState(false);
  const { saved, toggle: toggleSaved } = useBookmarks(quizApi);
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // Server-authoritative daily goal: `goalCurrent` = correctly-completed today,
  // `goalTarget` = the daily goal. These drive the x/N counter AND the bar; they
  // move ONLY when the server confirms a correct answer (completed_now).
  const [goalCurrent, setGoalCurrent] = useState(0);
  const [goalTarget, setGoalTarget] = useState(0);
  // Additional-learning batch size: set (5/10/15/20) only when the user opted
  // into extra study after completing today's goal, else null (a normal,
  // goal-driven session). Persisted in the snapshot so a refresh restores it.
  const [additionalCount, setAdditionalCount] = useState<number | null>(navState?.additionalCount ?? null);

  // The adaptive session behind this set (reviewed content, graded on the
  // server, grounded tutor). Null for writing — adaptive sessions serve
  // objectively graded items only — and when the legacy recommender is the
  // fallback because no reviewed content fits.
  const [study, setStudy] = useState<StudyRef | null>(null);
  // Quiz keys whose server activity is closed: re-answers (다시 풀기) are
  // practice, checked locally against the revealed key and never credited.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const adaptive = section !== "writing";

  // Idempotency key for the CURRENT submission. Stable across retries of the same
  // answer (a lost-response re-press reuses it → the server dedupes), and cleared
  // whenever the answer changes or the question advances so a genuinely new
  // submission gets a fresh key and is counted.
  const requestIdRef = useRef<string | null>(null);
  // Identifies THIS personalized-learning session to the server so a correct
  // answer credits the goal + points at most once per question per session.
  // Preserved across a 다시 시작 restart (re-answers don't re-credit) but fresh
  // per mount — so additional learning is a new session that credits again.
  const learningSessionIdRef = useRef<string>(randomUuid());
  const startedAt = useRef(Date.now());
  const exit = useExitSession("topik", clearTopikSession);

  function applySession(s: StudySession) {
    const acts = visibleActivities(s);
    setStudy({ sessionId: s.session_id, revision: s.current_revision });
    setItems(acts.map((a) => activityToQuiz(a, s.learner_band)));
    setCorrectSet(new Set(acts.filter(answeredCorrectly).map(quizKey)));
    setAttempted(new Set(acts.filter((a) => a.attempts.length > 0).map(quizKey)));
    setClosed(new Set(acts.filter((a) => !isOpenActivity(a)).map(quizKey)));
    const firstOpen = acts.findIndex(isOpenActivity);
    setIdx(firstOpen >= 0 ? firstOpen : 0);
    resetQuestionPhase();
  }

  // Load the set: the adaptive session for listening/reading — started, or
  // resumed with the same scope (another scope ends the old session on the
  // server) — and the legacy recommender for writing or when no reviewed
  // content fits.
  async function loadSet(code?: string | null, snap?: TopikSessionSnapshot | null) {
    if (busy) return;
    if (adaptive) {
      setBusy(true);
      setError(false);
      try {
        const s = await startStudySession(
          {
            track: "topik",
            explanation_language: explanationLanguage(language),
            topik_section: section as "listening" | "reading",
            ...(code ? { topik_question_type: code } : {}),
          },
          additionalCount ?? (remaining || undefined),
        );
        if (snap && snap.studySessionId === s.session_id) {
          // Same session after a refresh: keep what only this screen knows.
          setDrafts(snap.drafts ?? {});
          setPoints(snap.points ?? 0);
          startedAt.current = snap.startedAt ?? Date.now();
          if (snap.learningSessionId) learningSessionIdRef.current = snap.learningSessionId;
          setRetrying(!!snap.retrying);
        } else {
          setDrafts({});
          setRetrying(false);
        }
        applySession(s);
        if (s.shortfall_message) toast.show(localizedMessage(s.shortfall_message, language));
        return;
      } catch (e) {
        if (!isApiCode(e, "session.no_eligible_content")) {
          if (items === null) setError(true);
          else toast.error(errorMessage(e));
          return;
        }
        // Nothing reviewed fits: fall through to the recommender.
        setStudy(null);
      } finally {
        setBusy(false);
      }
    }
    setBusy(true);
    setError(false);
    try {
      // Additional learning requests the exact chosen count; a normal session
      // requests the remaining daily goal (min 1).
      const count = additionalCount ?? Math.max(remaining || 0, 1);
      const res = await recApi.questions({ section, count, ...(code ? { topik_question_type: code } : {}) });
      setItems(res.items);
      setIdx(0);
      setDrafts({});
      resetQuestionPhase();
      setCorrectSet(new Set());
      setAttempted(new Set());
      setRetrying(false);
    } catch (e) {
      if (items === null) setError(true);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Clear all per-question result state so a (new or re-entered) question starts
  // clean: nothing selected-as-result, Submit governs the CTA, no stale loading.
  function resetQuestionPhase() {
    setPhase("answering");
    setResult(null);
    setWrongKeys([]);
    setSubmittedValue(null);
    requestIdRef.current = null;
  }

  // On boot, resume a saved session (same section) if one exists — e.g. after a
  // refresh — so we never regenerate content or drop drafts; otherwise fetch a
  // fresh set once the dashboard (remaining goal) has settled.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || !ready) return;
    booted.current = true;
    const snap = readTopikSession();
    if (snap && snap.section === section && snap.studySessionId) {
      // Adaptive: items and progress come back from the server session.
      setTypeCode(snap.typeCode ?? null);
      setGoalCurrent(snap.goalCurrent ?? topik?.goal.current ?? 0);
      setGoalTarget(snap.goalTarget ?? topik?.goal.target ?? 0);
      setAdditionalCount(snap.additionalCount ?? null);
      void loadSet(snap.typeCode ?? null, snap);
    } else if (snap && snap.section === section) {
      setItems(snap.items);
      setIdx(snap.idx);
      setDrafts(snap.drafts ?? {});
      setCorrectSet(new Set(snap.correct));
      setAttempted(new Set(snap.attempted ?? []));
      setPoints(snap.points ?? 0);
      setTypeCode(snap.typeCode ?? null);
      startedAt.current = snap.startedAt ?? Date.now();
      // Restore server-authoritative progress; fall back to the dashboard goal.
      setGoalCurrent(snap.goalCurrent ?? topik?.goal.current ?? 0);
      setGoalTarget(snap.goalTarget ?? topik?.goal.target ?? 0);
      setAdditionalCount(snap.additionalCount ?? null);
      // Keep the same session id across a refresh so a retry still dedups credit.
      if (snap.learningSessionId) learningSessionIdRef.current = snap.learningSessionId;
      setRetrying(!!snap.retrying);
      // A restored session always reopens the current question UNRESOLVED — the
      // learner may have refreshed mid-attempt. Progress is the persisted count;
      // no credit is added by restoring.
      resetQuestionPhase();
    } else {
      setGoalCurrent(topik?.goal.current ?? 0);
      setGoalTarget(topik?.goal.target ?? 0);
      void loadSet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const total = items?.length ?? 0;
  const cur = items?.[idx];
  // Progress is derived ONLY from server-confirmed correct completions vs the
  // daily goal — never from attempts, the question index, or response count.
  const dailyGoal = goalTarget || total || 1;
  const correctlyCompleted = Math.min(goalCurrent, dailyGoal);
  // An ADDITIONAL (post-goal) session shows its OWN batch progress
  // (correct-in-session / chosen count); the daily goal stays 100% and is not
  // shown here. A normal session shows the server-authoritative daily progress.
  const isAdditional = additionalCount != null;
  const batchTotal = total || additionalCount || 1;
  const shownCurrent = isAdditional ? Math.min(correctSet.size, batchTotal) : correctlyCompleted;
  const shownTotal = isAdditional ? batchTotal : dailyGoal;
  // Session-end condition: an additional batch ends when its items are done
  // (never early on the already-met daily goal); a normal session ends when the
  // daily goal is reached.
  const targetReached = isAdditional ? shownCurrent >= shownTotal : goalTarget > 0 && correctlyCompleted >= goalTarget;
  // True on the final correct answer of the session — the set is exhausted or the
  // goal is met. While retrying (goal already met) only the exhausted-set case
  // ends it, so the learner can re-solve every question. The completion CTA is
  // then presented as a bottom-up sheet.
  const isLastStep = idx >= total - 1 || (!retrying && targetReached);
  // The current item's working answer, derived from the per-item draft map.
  const value: AnswerValue = cur ? (drafts[cur.quiz_id] ?? {}) : {};
  const setValue = (v: AnswerValue) => {
    if (!cur) return;
    setDrafts((d) => ({ ...d, [cur.quiz_id]: v }));
    // A changed answer is a new submission — drop the current idempotency key so
    // the next submit gets a fresh one (and is counted).
    requestIdRef.current = null;
    // Selecting/editing after an incorrect result re-arms the question: back to
    // the answering phase, banner cleared, Submit re-enabled. The previously
    // wrong option stays red (wrongKeys); the new selection is neutral.
    if (phase === "incorrect") {
      setPhase("answering");
      setResult(null);
    }
  };

  // Persist the session (debounced) so a refresh restores the set, position,
  // drafts, and authoritative progress. Debounced so keystrokes don't thrash.
  useEffect(() => {
    if (!items) return;
    const timer = setTimeout(
      () =>
        saveTopikSession({
          section,
          items,
          idx,
          drafts,
          correct: [...correctSet],
          attempted: [...attempted],
          points,
          typeCode,
          startedAt: startedAt.current,
          goalCurrent,
          goalTarget,
          additionalCount,
          learningSessionId: learningSessionIdRef.current,
          retrying,
          studySessionId: study?.sessionId ?? null,
        }),
      300,
    );
    return () => clearTimeout(timer);
  }, [items, idx, drafts, correctSet, attempted, points, typeCode, section, goalCurrent, goalTarget, additionalCount, retrying, study]);

  // A question on screen counts as study: displaying it records today's
  // learning activity (streak + learning day + the sun), once per local day and
  // silently — no answer needed. Nothing is recorded while loading or on the
  // error state (no question shown).
  useRecordDisplayedItem("topik", error ? null : cur?.quiz_id);
  usePresentActivity(study, isStudyItem(cur) ? cur.activity_id : null);

  // Submit-enabled iff: a valid answer is selected, we're not mid-request, the
  // question isn't already correct, and the answer differs from the last one
  // submitted (so an identical wrong answer isn't re-offered).
  const answerChanged = useMemo(() => {
    if (!submittedValue) return true;
    return JSON.stringify(value) !== JSON.stringify(submittedValue);
  }, [value, submittedValue]);
  const canSubmit =
    !!cur && phase !== "submitting" && phase !== "correct" && phase !== "revealed" && canSubmitTopik(cur, value) && answerChanged;

  // One graded answer on an adaptive activity. A closed activity (다시 풀기)
  // is practice: checked against the revealed key here, nothing recorded.
  async function studyAttempt(q: StudyQuiz, submitted: AnswerValue, clientRequestId: string) {
    if (closed.has(q.quiz_id)) {
      return {
        res: { attempt_id: `${q.activity_id}:practice`, correct: submitted.choiceKey === revealedChoiceKey(q.reveal), status: "graded" },
        closedNow: false,
        practice: true,
      };
    }
    const r = await studyApi.attempt(study!.sessionId, q.activity_id, {
      answer: submitted.choiceKey ?? "",
      client_request_id: clientRequestId,
    });
    if (r.reveal) {
      const reveal = r.reveal;
      setItems((list) => list?.map((it) => (isStudyItem(it) && it.activity_id === q.activity_id ? { ...it, reveal } : it)) ?? list);
    }
    const closedNow = isClosedStatus(r.activity_status);
    if (closedNow) setClosed((c) => withKey(c, q.quiz_id));
    return { res: studyToQuizResult(r, q.activity_id), closedNow, practice: false, reveal: r.reveal };
  }

  async function submit() {
    if (!cur || !canSubmit) return;
    setPhase("submitting");
    const submitted = value;
    try {
      const clientRequestId = (requestIdRef.current ??= randomUuid());
      let res: QuizAttemptResult;
      if (isStudyItem(cur) && study) {
        const out = await studyAttempt(cur, submitted, clientRequestId);
        res = out.res;
        if (out.practice) {
          // Practice keeps credit and the correct set as they are.
          setResult(res);
          setSubmittedValue(submitted);
          if (res.correct) setPhase("correct");
          else {
            setPhase("incorrect");
            setWrongKeys((k) => withWrongKey(k, submitted.choiceKey));
          }
          return;
        }
        if (!res.correct && out.closedNow) {
          // Second wrong answer: the item closes and the correct option is
          // shown (the adaptive policy); nothing is credited.
          setResult(res);
          setSubmittedValue(submitted);
          setAttempted((a) => withKey(a, cur.quiz_id));
          setWrongKeys((k) => withWrongKey(k, submitted.choiceKey));
          setPhase("revealed");
          toast.show(t("session.topikAnswerShown"));
          return;
        }
      } else {
        res = await quizApi.attempt(cur.quiz_id, {
          ...quizAttemptBody(cur, submitted),
          client_request_id: clientRequestId,
          learning_session_id: learningSessionIdRef.current,
        });
      }
      setResult(res);
      setSubmittedValue(submitted);
      setAttempted((a) => withKey(a, cur.quiz_id));
      if (isRetryableWrong(res)) {
        // Wrong: stay on the question. Mark the submitted option red (MC) and
        // return to a state where Submit is available once a new option is
        // chosen. NOTHING is credited — the server credited nothing either.
        setPhase("incorrect");
        setWrongKeys((keys) => withWrongKey(keys, submitted.choiceKey));
      } else {
        // Correct (or terminal writing): lock the question, show Next. Credit
        // strictly from the server's authoritative snapshot — the bar moves
        // only when completed_now is true.
        setPhase("correct");
        if (res.correct) setCorrectSet((c) => withKey(c, cur.quiz_id));
        if (res.completed_now) setPoints((p) => p + (res.points_earned ?? 0));
        if (res.daily_progress) {
          setGoalCurrent(res.daily_progress.current);
          setGoalTarget(res.daily_progress.target);
        } else if (res.completed_now) {
          setGoalCurrent((c) => c + 1);
        }
      }
    } catch (e) {
      // Request failed: return to answering so the learner can retry safely.
      // No progress was credited (server never confirmed).
      setPhase(result ? "incorrect" : "answering");
      // An ended session (idle expiry) cannot take answers: start a fresh one.
      if (isApiCode(e, "session.not_active")) void loadSet(typeCode);
      else toast.error(errorMessage(e));
    }
  }

  function next() {
    // Only reachable in the "correct" phase (Next button). Advance to the next
    // question, or finish when the set is exhausted / the goal is reached.
    if (cur) setDrafts((d) => withoutEntry(d, cur.quiz_id));
    if (isLastStep) {
      finishOrExit();
    } else {
      setIdx((i) => i + 1);
      resetQuestionPhase();
    }
  }

  // 다시 시작 from the completion sheet: redo the SAME set from the first
  // question as pure practice. The first completion already finalized the points
  // and the completed-question count (server-side, per the session dedup key), so
  // the retry MUST NOT change either — only the per-question answer state resets.
  // Points, the correct-answer set, and elapsed time are deliberately kept, so
  // leaving mid-retry (Back) still retains what the first attempt earned.
  function restartSession() {
    setIdx(0);
    setDrafts({});
    resetQuestionPhase();
    setCompleted(false);
    setRetrying(true);
  }

  // Same gate for the CTA at completion and the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  function exitSession() {
    return exit({ study, attempted: attempted.size > 0, startedAt: startedAt.current });
  }

  function selectType(code: string) {
    setTypeCode(code);
    void loadSet(code);
  }

  return {
    grade,
    study,
    cur,
    phase,
    result,
    value,
    setValue,
    wrongKeys,
    canSubmit,
    submit,
    next,
    isLastStep,
    progress: { current: shownCurrent, total: shownTotal, ratio: shownTotal ? shownCurrent / shownTotal : 0 },
    correctCount: correctSet.size,
    points,
    completed,
    error,
    saved,
    toggleSave: (q: Quiz) => toggleSaved(q.quiz_id),
    typeOptions: types.data?.items ?? [],
    typeCode,
    typesOpen,
    setTypesOpen,
    selectType,
    retryLoad: () => void loadSet(typeCode),
    restartSession,
    finishOrExit,
    exitSession,
  };
}
