import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { quizApi } from "../../api/endpoints";
import { canSubmitTopik } from "../../components/topik/TopikQuestion";
import { quizAttemptBody, type AnswerValue } from "../../components/QuestionView";
import { useToast } from "../../hooks/toast";
import { useRecordDisplayedItem } from "../../hooks/learningActivity";
import { errorMessage } from "../../lib/http";
import type { Quiz, QuizAttemptResult } from "../../lib/types";
import { randomUuid } from "../../lib/uuid";

/**
 * One saved TOPIK question under review: the item (from the URL, so a refresh
 * restores it), its draft, `source="review"` attempts — the server awards
 * review points once per session and never touches goal or level progress —
 * 다시 풀기, and the bookmark.
 */
export function useQuestionReview(quizId: string) {
  const toast = useToast();
  const qc = useQueryClient();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState(false);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  // The option key of the MOST RECENT submitted-wrong answer (rendered coral).
  // Only the latest wrong submission is highlighted — selecting another option or
  // submitting again clears the previous one. `null` when there is no standing
  // wrong result to show.
  const [wrongKey, setWrongKey] = useState<string | null>(null);
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
  // so a refresh restores the same item. Every (re)initialization starts fully
  // reset: no option selected, no result, no highlight.
  useEffect(() => {
    let cancelled = false;
    setQuiz(null);
    setError(false);
    setResult(null);
    setWrongKey(null);
    setValue({});
    setRewardPoints(null);
    setSessionPoints(0);
    setRewardOpen(false);
    // A different item is a new review session — start a fresh award key.
    reviewSessionId.current = randomUuid();
    quizApi
      .get(quizId)
      .then((q) => {
        if (cancelled) return;
        setQuiz(q);
        setSaved(!!(q.is_favorited ?? q.bookmarked));
        // Restore a persisted draft ONLY for text answers (writing / fill-blanks)
        // so a refresh keeps typed text. A multiple-choice question always starts
        // with no option selected — a saved choice must never carry into a new
        // session or a reopened question.
        if (q.answer.format !== "single_choice") {
          try {
            const raw = sessionStorage.getItem(draftKey);
            if (raw) setValue(JSON.parse(raw) as AnswerValue);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  // Persist the working answer so a refresh keeps the writing draft. Only text
  // answers are persisted — MC selections are intentionally never stored, so a
  // reopened question can't resurrect a previous choice.
  useEffect(() => {
    if (!quiz || rewardPoints !== null || quiz.answer.format === "single_choice") return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [value, quiz, rewardPoints, draftKey]);

  // The saved question on screen counts as study: displaying it records
  // today's learning activity (streak + learning day + the sun), once per local
  // day and silently — reviewing it counts even before an answer.
  useRecordDisplayedItem("topik", error ? null : quiz?.quiz_id);

  const completed = rewardPoints !== null;
  // Writing is scored, never right/wrong (`correct` is null) — it keeps the
  // neutral header and shows the score card below.
  const isWriting = !!result?.writing || result?.status === "submitted";
  const incorrect = !!result && !isWriting && !result.correct;

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
      // A correct selection completes the item — and so does any writing
      // answer, which is scored rather than right/wrong (as in SessionTopik).
      if (res.correct || res.writing || res.status === "submitted") {
        setWrongKey(null); // clear any prior wrong highlight — show only the correct option
        setRewardPoints(res.points_earned ?? 0);
        setSessionPoints((p) => p + (res.points_earned ?? 0));
        // A review award creates a points notification — refresh the badge.
        qc.invalidateQueries({ queryKey: ["notif-unread"] });
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
      } else {
        // A graded-wrong selection: highlight ONLY this submission (coral),
        // replacing any earlier wrong highlight. The correct answer is never
        // revealed on a wrong attempt.
        setWrongKey(value.choiceKey ?? null);
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
    setWrongKey(null);
    setValue({});
    setRewardPoints(null);
    startedAt.current = Date.now();
  }

  // Changing the selection after a result re-arms the question: clear the verdict
  // and the previous wrong highlight so only the newly-selected (neutral) option
  // shows. No effect once completed (the question is locked).
  function handleChange(v: AnswerValue) {
    setValue(v);
    if (result && !completed) {
      setResult(null);
      setWrongKey(null);
    }
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

  return {
    quiz,
    error,
    value,
    handleChange,
    result,
    wrongKey,
    submitting,
    submit,
    completed,
    isWriting,
    incorrect,
    restart,
    rewardPoints,
    sessionPoints,
    rewardOpen,
    setRewardOpen,
    saved,
    toggleSave,
  };
}
