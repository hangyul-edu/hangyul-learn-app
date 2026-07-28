import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { TopikQuestion, canSubmitTopik, questionKind } from "../components/topik/TopikQuestion";
import { TopikResult } from "../components/topik/TopikResult";
import { ResultHeader, type ResultStatus } from "../components/topik/ResultHeader";
import { quizAttemptBody, type AnswerValue } from "../components/QuestionView";
import { SavePlusIcon } from "../components/brand/HomeIcons";
import { LoadingState, ErrorState } from "../components/ui/states";
import { quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useAuth } from "../hooks/auth";
import { errorMessage } from "../lib/http";
import { normalizeLanguage } from "../lib/language";
import { randomUuid } from "../lib/uuid";
import { REVIEW_SESSION_COPY } from "../lib/reviewSessionCopy";
import { TOPIK_SESSION_COPY } from "../lib/topikSessionCopy";
import type { Quiz, QuizAttemptResult } from "../lib/types";

/**
 * Single-item review session for a saved TOPIK question. Reuses the TOPIK
 * renderer, result, and submit-gating from personalized learning, but has
 * exactly one fixed item (from the URL, so refresh restores it), no progress /
 * goal / config chrome, and submits with source="review" — the server awards
 * review points and never touches goal or level progress. On a correct answer a
 * two-button sheet appears; 완료 opens the reward modal, then returns to /saved.
 */
export function SessionReview() {
  const { quizId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useAuth();
  const qc = useQueryClient();
  const lang = normalizeLanguage(me?.app_language);
  const copy = REVIEW_SESSION_COPY[lang];
  const topikCopy = TOPIK_SESSION_COPY[lang];

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState(false);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  // Option keys submitted and confirmed wrong for the current item — kept coral
  // while the learner retries (review reveals the correct option in blue).
  const [wrongKeys, setWrongKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Set once the item is answered correctly (points from the latest attempt);
  // doubles as the "completed" gate. Reset to null by a restart to re-enable
  // answering, so it is NOT a running total.
  const [rewardPoints, setRewardPoints] = useState<number | null>(null);
  // Running total of points earned across the whole session — accumulated on
  // every correct attempt and preserved across restarts, so the completion
  // modal shows the real total (a deduped re-answer after a restart earns 0).
  const [sessionPoints, setSessionPoints] = useState(0);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());
  // Identifies THIS review session to the server so review points are awarded
  // once per session. Regenerated when the item (or mount) changes — i.e. a new
  // session — but deliberately preserved across `restart()`, so re-answering the
  // same item after a restart collides on the key and is not re-awarded.
  const reviewSessionId = useRef(randomUuid());

  const draftKey = `hangyul.review.quiz.${quizId}`;

  // Fetch the exact saved question (never generate/replace). Keyed on the URL id
  // so a refresh restores the same item; a persisted writing draft is restored.
  useEffect(() => {
    let cancelled = false;
    setQuiz(null);
    setError(false);
    setResult(null);
    setWrongKeys([]);
    setRewardPoints(null);
    setSessionPoints(0);
    setRewardOpen(false);
    // A different item is a new review session — start a fresh award key.
    reviewSessionId.current = randomUuid();
    try {
      const raw = sessionStorage.getItem(draftKey);
      setValue(raw ? (JSON.parse(raw) as AnswerValue) : {});
    } catch {
      setValue({});
    }
    quizApi
      .get(quizId)
      .then((q) => {
        if (cancelled) return;
        setQuiz(q);
        setSaved(!!(q.is_favorited ?? q.bookmarked));
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  // Persist the working answer so a refresh keeps the writing draft.
  useEffect(() => {
    if (!quiz || rewardPoints !== null) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [value, quiz, rewardPoints, draftKey]);

  const completed = rewardPoints !== null;
  const incorrect = !!result && !result.correct;

  async function submit() {
    if (!quiz || submitting || completed || !canSubmitTopik(quiz, value)) return;
    setSubmitting(true);
    try {
      const elapsed_ms = Math.max(0, Date.now() - startedAt.current);
      const res = await quizApi.attempt(quiz.quiz_id, {
        ...quizAttemptBody(quiz, value),
        elapsed_ms,
        source: "review",
        review_session_id: reviewSessionId.current,
      });
      setResult(res);
      if (res.correct) {
        setRewardPoints(res.points_earned ?? 0);
        setSessionPoints((p) => p + (res.points_earned ?? 0));
        // The review award created a points notification — refresh the badge.
        qc.invalidateQueries({ queryKey: ["notif-unread"] });
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      } else if (res.status !== "submitted" && !res.writing && value.choiceKey) {
        // A graded-wrong selection: remember the submitted option so it stays
        // coral while the learner retries.
        setWrongKeys((keys) => (keys.includes(value.choiceKey!) ? keys : [...keys, value.choiceKey!]));
      }
    } catch (e) {
      // A technical failure is not a wrong answer — keep the draft, allow retry.
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    // Redo the same item within the SAME session. `reviewSessionId` is kept, so
    // the server dedups the review award — a restart never grants points again.
    setResult(null);
    setWrongKeys([]);
    setValue({});
    setRewardPoints(null);
    startedAt.current = Date.now();
  }

  // A saved-question review is only ever opened from the Saved > Questions list,
  // so leaving it (back chevron or the reward modal's confirm) returns there.
  // Navigating with an explicit `tab: "quiz"` lands on the Questions tab even
  // when the list's return snapshot can't be restored — otherwise Saved defaults
  // to the Sentences tab.
  function backToSaved() {
    nav("/saved", { state: { tab: "quiz" } });
  }

  async function toggleSave() {
    if (!quiz) return;
    const on = saved;
    setSaved(!on);
    try {
      if (on) await quizApi.unbookmark(quiz.quiz_id);
      else await quizApi.bookmark(quiz.quiz_id);
    } catch (e) {
      setSaved(on);
      toast.error(errorMessage(e));
    }
  }

  const askContext = !quiz
    ? null
    : incorrect && result
      ? { contextKind: "quiz_attempt" as const, contextId: result.attempt_id, autoExplain: true, bubble: true }
      : { contextKind: "quiz" as const, contextId: quiz.quiz_id, autoExplain: false, bubble: false };

  // Writing is scored, never right/wrong — it keeps the neutral header and shows
  // the score card below.
  const isWriting = !!result?.writing || result?.status === "submitted";
  // Verdict shown in the result header: blue "correct" / coral "retry" for a
  // graded selection answer; neutral otherwise.
  const headerStatus: ResultStatus =
    result && !isWriting ? (result.correct ? "correct" : "incorrect") : "none";
  const audioTone: "neutral" | "incorrect" = headerStatus === "incorrect" ? "incorrect" : "neutral";
  // Per-option markers. Review REVEALS the answer: the correct option is blue
  // (the chosen key when right, the server's correct_answer when wrong) and the
  // learner's submitted wrong option(s) stay coral.
  const optionResult = {
    correctKey: result ? (result.correct ? (value.choiceKey ?? null) : (result.correct_answer ?? null)) : null,
    wrongKeys,
  };
  const bookmarkButton = quiz && (
    <button
      className="sess__bookmark"
      onClick={toggleSave}
      aria-label={saved ? topikCopy.removeSaved : topikCopy.saveQuestion}
      aria-pressed={saved}
    >
      <SavePlusIcon active={saved} />
    </button>
  );

  return (
    <>
      <SessionChrome minimal title={copy.questionTitle} askContext={askContext} onBack={backToSaved}>
        {error ? (
          <ErrorState message={copy.loadError} onRetry={() => nav(0)} />
        ) : !quiz ? (
          <LoadingState />
        ) : (
          <div className="sess__card sess__card--topik">
            <ResultHeader status={headerStatus} title={topikCopy.title} copy={topikCopy} bookmark={bookmarkButton} />

            <TopikQuestion
              quiz={quiz}
              value={value}
              onChange={setValue}
              disabled={completed || submitting}
              copy={topikCopy}
              optionResult={optionResult}
              tone={audioTone}
            />

            {/* Writing answers show the score card; selection verdicts are carried
                by the header + the blue (correct) / coral (submitted-wrong) options. */}
            {result && isWriting && <TopikResult result={result} copy={topikCopy} />}

            {!completed && (
              <div className="sess__cta">
                <button
                  className="sess__submit"
                  onClick={submit}
                  disabled={!canSubmitTopik(quiz, value) || submitting}
                >
                  {submitting ? (
                    <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} />
                  ) : (
                    topikCopy.submit
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </SessionChrome>

      {completed && !rewardOpen && (
        <ReviewCompleteSheet
          leftLabel={quiz && questionKind(quiz) === "listening_multiple_choice" ? copy.listenAgain : copy.restart}
          onLeft={restart}
          onComplete={() => setRewardOpen(true)}
          copy={copy}
        />
      )}
      {rewardOpen && rewardPoints !== null && (
        <ReviewRewardModal points={sessionPoints} copy={copy} onConfirm={backToSaved} />
      )}
    </>
  );
}
