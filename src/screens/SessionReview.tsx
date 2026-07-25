import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SessionChrome } from "../components/SessionChrome";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { TopikQuestion, canSubmitTopik } from "../components/topik/TopikQuestion";
import { TopikResult } from "../components/topik/TopikResult";
import { quizAttemptBody, type AnswerValue } from "../components/QuestionView";
import { SavePlusIcon } from "../components/brand/HomeIcons";
import { LoadingState, ErrorState } from "../components/ui/states";
import { quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useAuth } from "../hooks/auth";
import { errorMessage } from "../lib/http";
import { normalizeLanguage } from "../lib/language";
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
  const lang = normalizeLanguage(me?.app_language);
  const copy = REVIEW_SESSION_COPY[lang];
  const topikCopy = TOPIK_SESSION_COPY[lang];

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState(false);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once the item is answered correctly (points from the server attempt).
  const [rewardPoints, setRewardPoints] = useState<number | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const startedAt = useRef(Date.now());

  const draftKey = `hangyul.review.quiz.${quizId}`;

  // Fetch the exact saved question (never generate/replace). Keyed on the URL id
  // so a refresh restores the same item; a persisted writing draft is restored.
  useEffect(() => {
    let cancelled = false;
    setQuiz(null);
    setError(false);
    setResult(null);
    setRewardPoints(null);
    setRewardOpen(false);
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
      });
      setResult(res);
      if (res.correct) {
        setRewardPoints(res.points_earned ?? 0);
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      // A technical failure is not a wrong answer — keep the draft, allow retry.
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    // Redo the same item; points already awarded are not re-awarded here.
    setResult(null);
    setValue({});
    setRewardPoints(null);
    startedAt.current = Date.now();
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

  return (
    <>
      <SessionChrome minimal title={copy.questionTitle} askContext={askContext} onBack={() => nav("/saved")}>
        {error ? (
          <ErrorState message={copy.loadError} onRetry={() => nav(0)} />
        ) : !quiz ? (
          <LoadingState />
        ) : (
          <div className="sess__card">
            <div className="sess__card-top">
              <p className="sess__instr sess__instr--topik">{topikCopy.title}</p>
              <button
                className="sess__bookmark"
                onClick={toggleSave}
                aria-label={saved ? topikCopy.removeSaved : topikCopy.saveQuestion}
                aria-pressed={saved}
              >
                <SavePlusIcon active={saved} />
              </button>
            </div>

            <TopikQuestion quiz={quiz} value={value} onChange={setValue} disabled={completed} copy={topikCopy} />

            {result && <TopikResult result={result} copy={topikCopy} />}

            {!completed && (
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
            )}
          </div>
        )}
      </SessionChrome>

      {completed && !rewardOpen && (
        <ReviewCompleteSheet
          leftLabel={copy.restart}
          onLeft={restart}
          onComplete={() => setRewardOpen(true)}
          copy={copy}
        />
      )}
      {rewardOpen && rewardPoints !== null && (
        <ReviewRewardModal points={rewardPoints} copy={copy} onConfirm={() => nav("/saved")} />
      )}
    </>
  );
}
