import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { quizAttemptBody, type AnswerValue } from "../components/QuestionView";
import { randomUuid } from "../lib/uuid";
import { TopikQuestion, canSubmitTopik } from "../components/topik/TopikQuestion";
import { TopikResult } from "../components/topik/TopikResult";
import { ResultHeader, type ResultStatus } from "../components/topik/ResultHeader";
import { SaveBookmarkButton } from "../components/SaveBookmarkButton";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, quizApi, dashboardApi, learnApi, studyApi } from "../api/endpoints";
import {
  activityToQuiz,
  answeredCorrectly,
  isApiCode,
  isOpenActivity,
  isStudyItem,
  quizKey,
  revealedChoiceKey,
  studyToQuizResult,
  visibleActivities,
  type StudyQuiz,
} from "../lib/studySession";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { errorMessage } from "../lib/http";
import { useTopikSessionCopy } from "../lib/topikSessionCopy";
import { TOPIK_TYPE_LABEL_EN, TOPIK_TYPE_LABEL_KO } from "../lib/topikTypeLabels";
import type { Quiz, QuizAttemptResult, StudySession, TopikQuestionType, TopikSection } from "../lib/types";
import {
  clearTopikSession,
  readTopikSession,
  saveTopikSession,
  type TopikSessionSnapshot,
} from "../lib/topikSessionSnapshot";

/**
 * The full picker label for a TOPIK question type, in the app language, taken
 * from the dropdown frames (see ../lib/topikTypeLabels). The API's `title_ko` /
 * `title_en` are generator descriptions, not UI labels, so they are used only
 * as the fallback for a code the map does not know yet — a question type added
 * server-side still renders rather than vanishing.
 */
function typeLabel(
  item: TopikQuestionType,
  language: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const ko = language === "ko";
  const fromFigma = (ko ? TOPIK_TYPE_LABEL_KO : TOPIK_TYPE_LABEL_EN)[item.code];
  if (fromFigma) return fromFigma;
  return t("session.topikTypeLabel", {
    n: item.number_label,
    title: ko ? item.title_ko : item.title_en?.trim() || item.title_ko,
  });
}

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
type Phase = "answering" | "submitting" | "incorrect" | "correct" | "revealed";

/** The most activities one adaptive session plans (server limit). */
const MAX_SESSION_ACTIVITIES = 20;

/** A submitted answer is a retryable wrong answer only for graded selection
 * questions (MC / fill-blanks). Writing is scored, never right/wrong, so it is
 * terminal (→ Next) regardless. */
function isRetryableWrong(result: QuizAttemptResult): boolean {
  if (result.writing) return false;
  if (result.status === "submitted") return false; // deferred writing grade
  return result.correct === false;
}

export function SessionTopik() {
  const { t, language } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const navState = loc.state as
    | { from?: string; section?: TopikSection; additionalCount?: number }
    | null;
  // The TOPIK part chosen in the part-selection modal drives the question-type
  // dropdown and generation; it's fixed for the whole session. Fall back to
  // listening only if the screen is reached without a selection (deep link).
  const section: TopikSection = navState?.section ?? "listening";
  const qc = useQueryClient();
  const copy = useTopikSessionCopy();
  // Completion sheet reuses the Review-Learning bottom sheet verbatim (다시 시작 / 완료).
  const reviewCopy = useReviewSessionCopy();

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const topik = dash.data?.tracks.find((t) => t.category === "topik");
  const grade = topik?.level ?? 1;
  const remaining = topik ? Math.max(topik.goal.target - topik.goal.current, 0) : 0;

  const types = useQuery({
    queryKey: ["topik-question-types", section],
    queryFn: () => recApi.topikQuestionTypes(section),
  });

  const [openPanel, setOpenPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  // Dismiss the type dropdown on an outside press / Escape — it draws no
  // backdrop of its own, so nothing else would close it. Mirrors CountrySelect.
  // The listener is scoped to `panelRef`, which wraps the trigger as well as the
  // list: a press on the trigger is therefore "inside" and left to its own
  // toggle, rather than being closed here and immediately reopened by the click
  // that follows. Choosing a type is likewise inside, so selection is untouched.
  useEffect(() => {
    if (!openPanel) return;
    function onPointerDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpenPanel(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPanel(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPanel]);
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
  const [saved, setSaved] = useState<Record<string, boolean>>({});
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
  const [additionalCount, setAdditionalCount] = useState<number | null>(
    navState?.additionalCount ?? null,
  );

  // The adaptive session behind this set (reviewed content, graded on the
  // server, grounded tutor). Null for writing — adaptive sessions serve
  // objectively graded items only — and when the legacy recommender is the
  // fallback because no reviewed content fits.
  const [study, setStudy] = useState<{ sessionId: string; revision: number } | null>(null);
  // Quiz keys whose server activity is closed: re-answers (다시 풀기) are
  // practice, checked locally against the revealed key and never credited.
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const adaptive = section !== "writing";

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

  // Start the adaptive session for this part (and question type) — or resume
  // the active one with the same scope. Another scope ends the old session on
  // the server. A resumed session with nothing left open is finished and a
  // fresh one started.
  async function startStudy(code: string | null): Promise<StudySession> {
    const count = additionalCount ?? (remaining || undefined);
    const body = {
      track: "topik" as const,
      explanation_language: (language === "ko" ? "ko" : "en") as "ko" | "en",
      topik_section: section as "listening" | "reading",
      ...(code ? { topik_question_type: code } : {}),
      ...(count ? { activity_count: Math.min(count, MAX_SESSION_ACTIVITIES) } : {}),
    };
    let s = await studyApi.start({ ...body, client_request_id: randomUuid() });
    if (!visibleActivities(s).some(isOpenActivity)) {
      await studyApi.complete(s.session_id).catch(() => studyApi.abandon(s.session_id));
      s = await studyApi.start({ ...body, client_request_id: randomUuid() });
    }
    return s;
  }

  // Load the set: the adaptive session for listening/reading, the legacy
  // recommender for writing or when no reviewed content fits.
  async function loadSet(code?: string | null, snap?: TopikSessionSnapshot | null) {
    if (busy) return;
    if (adaptive) {
      setBusy(true);
      setError(false);
      try {
        const s = await startStudy(code ?? null);
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
        if (s.shortfall_message) toast.show(language === "ko" ? s.shortfall_message.ko : s.shortfall_message.en);
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
  // On boot, resume a saved session (same section) if one exists — e.g. after a
  // refresh — so we never regenerate content or drop drafts; otherwise fetch a
  // fresh set once the dashboard (remaining goal) has settled. A failed
  // dashboard still boots — the set is then sized by the server's default —
  // so the screen never waits on it forever.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || !dash.isFetched) return;
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
  }, [dash.isFetched]);

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
  const progress = shownTotal ? shownCurrent / shownTotal : 0;
  // Session-end condition: an additional batch ends when its items are done
  // (never early on the already-met daily goal); a normal session ends when the
  // daily goal is reached.
  const targetReached = isAdditional
    ? shownCurrent >= shownTotal
    : goalTarget > 0 && correctlyCompleted >= goalTarget;
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
    const snapshot: TopikSessionSnapshot = {
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
    };
    const timer = setTimeout(() => saveTopikSession(snapshot), 300);
    return () => clearTimeout(timer);
  }, [items, idx, drafts, correctSet, attempted, points, typeCode, section, goalCurrent, goalTarget, additionalCount, retrying, study]);

  // A question on screen counts as study: displaying it records today's
  // learning activity (streak + learning day + the sun), once per local day and
  // silently — no answer needed. Nothing is recorded while loading or on the
  // error state (no question shown).
  useRecordDisplayedItem("topik", error ? null : cur?.quiz_id);

  // Record that the current activity is on screen (exposure for the
  // repetition policy). Idempotent server-side.
  const curActivityId = isStudyItem(cur) ? cur.activity_id : null;
  useEffect(() => {
    if (study && curActivityId) void studyApi.present(study.sessionId, curActivityId).catch(() => undefined);
  }, [study, curActivityId]);

  // Submit-enabled iff: a valid answer is selected, we're not mid-request, the
  // question isn't already correct, and the answer differs from the last one
  // submitted (so an identical wrong answer isn't re-offered).
  const answerChanged = useMemo(() => {
    if (!submittedValue) return true;
    return JSON.stringify(value) !== JSON.stringify(submittedValue);
  }, [value, submittedValue]);
  const canSubmit =
    !!cur &&
    phase !== "submitting" &&
    phase !== "correct" &&
    phase !== "revealed" &&
    canSubmitTopik(cur, value) &&
    answerChanged;

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
    const closedNow = !["pending", "presented", "attempted"].includes(r.activity_status);
    if (closedNow) setClosed((c) => new Set(c).add(q.quiz_id));
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
            if (submitted.choiceKey) setWrongKeys((k) => (k.includes(submitted.choiceKey!) ? k : [...k, submitted.choiceKey!]));
          }
          return;
        }
        if (!res.correct && out.closedNow) {
          // Second wrong answer: the item closes and the correct option is
          // shown (the adaptive policy); nothing is credited.
          setResult(res);
          setSubmittedValue(submitted);
          setAttempted((a) => new Set(a).add(cur.quiz_id));
          if (submitted.choiceKey) setWrongKeys((k) => (k.includes(submitted.choiceKey!) ? k : [...k, submitted.choiceKey!]));
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
      setAttempted((a) => new Set(a).add(cur.quiz_id));
      if (isRetryableWrong(res)) {
        // Wrong: stay on the question. Mark the submitted option red (MC) and
        // return to a state where Submit is available once a new option is
        // chosen. NOTHING is credited — the server credited nothing either.
        setPhase("incorrect");
        if (submitted.choiceKey) {
          setWrongKeys((keys) => (keys.includes(submitted.choiceKey!) ? keys : [...keys, submitted.choiceKey!]));
        }
      } else {
        // Correct (or terminal writing): lock the question, show Next. Credit
        // strictly from the server's authoritative snapshot — the bar moves
        // only when completed_now is true.
        setPhase("correct");
        if (res.correct) setCorrectSet((c) => new Set(c).add(cur.quiz_id));
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
    if (cur) {
      setDrafts((d) => {
        const rest = { ...d };
        delete rest[cur.quiz_id];
        return rest;
      });
    }
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
    requestIdRef.current = null;
  }

  // Same gate for the CTA at completion and the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  // Single exit path for 완료 (modal) and the back chevron. Records the
  // personalized session's study time on the server. Finishing a session never
  // changes a level — levels come only from the server's proficiency
  // assessments. Single-flight so repeated taps can't double-record.
  const finalizingRef = useRef(false);
  async function exitSession() {
    if (finalizingRef.current) return;
    // Leaving ends the session: drop its snapshot so re-entry starts fresh.
    clearTopikSession();
    if (study) {
      // Completed when every activity is resolved, otherwise ended early.
      const id = study.sessionId;
      void studyApi.complete(id).catch(() => studyApi.abandon(id).catch(() => undefined));
    }
    if (attempted.size === 0) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav(-1);
      return;
    }
    finalizingRef.current = true;
    const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    try {
      await learnApi.recordSession({
        session_type: "sentence",
        category: "topik",
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

  async function toggleSave(q: Quiz) {
    const on = saved[q.quiz_id];
    setSaved((m) => ({ ...m, [q.quiz_id]: !on }));
    try {
      if (on) await quizApi.unbookmark(q.quiz_id);
      else await quizApi.bookmark(q.quiz_id);
    } catch (e) {
      setSaved((m) => ({ ...m, [q.quiz_id]: on }));
      toast.error(errorMessage(e));
    }
  }

  // Writing is scored (not right/wrong): a graded-writing or still-deferred
  // result renders the score card, never the correct/retry verdict header.
  const isWriting = !!result?.writing || result?.status === "submitted";
  // Verdict shown in the result header. Only a graded SELECTION answer gets the
  // blue/coral header; writing stays neutral (score shown below instead).
  const headerStatus: ResultStatus =
    phase === "incorrect" || phase === "revealed"
      ? "incorrect"
      : phase === "correct" && !!result?.correct && !isWriting
        ? "correct"
        : "none";
  // The listening player picks up the warm cream tint while retrying.
  const audioTone: "neutral" | "incorrect" = phase === "incorrect" ? "incorrect" : "neutral";
  // Options are interactive while answering AND after an incorrect result (the
  // learner must be able to pick another option immediately). They lock only on
  // a correct/terminal result or while a request is in flight.
  const optionsLocked = phase === "correct" || phase === "submitting" || phase === "revealed";
  // Per-option result markers: blue on the chosen key once correct (or on the
  // revealed key once an adaptive item ran out of tries), coral on any
  // wrong-submitted key. Absent while answering.
  const optionResult =
    phase === "correct" && result?.correct
      ? { correctKey: value.choiceKey ?? null, wrongKeys }
      : phase === "revealed" && isStudyItem(cur)
        ? { correctKey: revealedChoiceKey(cur.reveal), wrongKeys }
        : { correctKey: null, wrongKeys };
  // The question is finished (Next / completion sheet): answered correctly,
  // or closed with the answer shown.
  const resolved = phase === "correct" || phase === "revealed";
  const bookmarkButton = cur && (
    <SaveBookmarkButton
      saved={!!saved[cur.quiz_id]}
      onToggle={() => toggleSave(cur)}
      label={saved[cur.quiz_id] ? copy.removeSaved : copy.saveQuestion}
    />
  );

  const panel = (
    <div className="sess__dropdown" ref={panelRef}>
      <button className="sess__dropdown-field" onClick={() => setOpenPanel((o) => !o)} aria-expanded={openPanel} aria-haspopup="listbox">
        <span className={typeCode ? "sess__dropdown-val" : "sess__dropdown-ph"}>
          {typeCode
            ? (() => {
                const sel = types.data?.items.find((x) => x.code === typeCode);
                return sel ? typeLabel(sel, language, t) : t("session.selected");
              })()
            : t("session.topikTypePrompt")}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={openPanel ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} stroke="#8a929a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {openPanel && (
        <ul className="sess__dropdown-list" role="listbox" aria-label={t("session.topikTypeAria")}>
          {(types.data?.items ?? []).map((item) => (
            <li key={item.code} role="option" aria-selected={typeCode === item.code}>
              <button
                className={`sess__dropdown-item ${typeCode === item.code ? "is-selected" : ""}`}
                onClick={() => {
                  setTypeCode(item.code);
                  setOpenPanel(false);
                  void loadSet(item.code);
                }}
              >
                {typeLabel(item, language, t)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
    <SessionChrome
      title={t("session.topikGrade", { n: grade })}
      heading={t("session.dailyQuestionGoal")}
      correct={shownCurrent}
      total={shownTotal}
      progress={progress}
      panel={panel}
      onBack={finishOrExit}
      askContext={
        !cur
          ? null
          : isStudyItem(cur) && study
            ? // The grounded tutor: hints while the item is open, explanations after.
              {
                contextKind: "study_activity",
                sessionId: study.sessionId,
                contextId: cur.activity_id,
                autoExplain: phase === "incorrect" || phase === "revealed",
                bubble: phase === "incorrect" || phase === "revealed",
              }
          : phase === "incorrect" && result
            ? { contextKind: "quiz_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
            : { contextKind: "quiz", contextId: cur.quiz_id, autoExplain: false, bubble: false }
      }
    >
      {error ? (
        <ErrorState message={t("session.questionLoadError")} onRetry={() => loadSet(typeCode)} />
      ) : !cur ? (
        <LoadingState />
      ) : (
        <div className="sess__card sess__card--topik">
          <ResultHeader
            status={headerStatus}
            title={copy.title}
            copy={copy}
            bookmark={bookmarkButton}
            incorrectTitle={phase === "revealed" ? t("session.topikAnswerRevealedTitle") : undefined}
          />

          <TopikQuestion
            quiz={cur}
            value={value}
            onChange={setValue}
            disabled={optionsLocked}
            copy={copy}
            optionResult={optionResult}
            tone={audioTone}
          />

          {/* Writing answers show a score card; selection verdicts live in the
              header (the correct answer is never revealed after a wrong try). */}
          {phase === "correct" && result && isWriting && <TopikResult result={result} copy={copy} />}

          <div className="sess__cta">
            {resolved ? (
              // The final step's 완료 lives in the bottom-up completion sheet
              // (rendered below); intermediate answers keep the inline 다음.
              isLastStep ? null : (
                <button className="sess__next" onClick={next}>
                  {copy.next}
                </button>
              )
            ) : (
              <button className="sess__submit" onClick={submit} disabled={!canSubmit}>
                {phase === "submitting" ? (
                  <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} />
                ) : (
                  copy.submit
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </SessionChrome>
    {/* Bottom-up completion sheet on the final correct answer — identical to the
        one TOPIK Review Learning shows: 다시 시작 (redo the set) + 완료 (finalize,
        opening the summary modal). */}
    {resolved && isLastStep && !completed && cur != null && (
      <ReviewCompleteSheet
        /* TAL-018 (673:13337) labels this 다시 풀기, not the review flow's 다시 시작. */
        leftLabel={t("session.solveAgain")}
        onLeft={restartSession}
        onComplete={next}
        copy={reviewCopy}
      />
    )}
    {completed && (
      <SessionCompleteModal mode="topik" correctCount={correctSet.size} points={points} onConfirm={exitSession} />
    )}
    </>
  );
}
