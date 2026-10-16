import { useNavigate, useParams } from "react-router-dom";
import { useSavedReturn } from "../lib/savedReturn";
import { useTranslation } from "../i18n";
import { SessionChrome } from "../components/SessionChrome";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { TopikQuestion, canSubmitTopik } from "../components/topik/TopikQuestion";
import { TopikResult } from "../components/topik/TopikResult";
import { ResultHeader, type ResultStatus } from "../components/topik/ResultHeader";
import { SaveBookmarkButton } from "../components/SaveBookmarkButton";
import { LoadingState, ErrorState } from "../components/ui/states";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { useTopikSessionCopy } from "../lib/topikSessionCopy";
import { Spinner } from "../components/ui/Spinner";
import { useQuestionReview } from "./sessionReview/useQuestionReview";
import { useLeaveLockedLecture } from "../hooks/premiumLecture";

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
  const { t } = useTranslation();
  const copy = useReviewSessionCopy();
  const topikCopy = useTopikSessionCopy();
  // Leaving the review (back chevron or the reward modal's 확인) returns to the
  // saved-learning category it was opened from, carried in this route's state.
  // A cold deep link with no origin falls back to Questions — the category this
  // route serves — never to Sentences.
  const backToSaved = useSavedReturn("problem");

  const {
    quiz,
    error,
    locked,
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
  } = useQuestionReview(quizId);
  // A premium lecture's checkpoint question without premium access: back to
  // the saved list (or where the link came from) with the lecture notice.
  useLeaveLockedLecture(locked, "lecture", "/saved");

  const askContext = !quiz
    ? null
    : incorrect && result
      ? { contextKind: "quiz_attempt" as const, contextId: result.attempt_id, autoExplain: true, bubble: true }
      : { contextKind: "quiz" as const, contextId: quiz.quiz_id, autoExplain: false, bubble: false };

  // Verdict shown in the result header: blue "correct" / coral "retry" for a
  // graded selection answer; neutral otherwise.
  const headerStatus: ResultStatus =
    result && !isWriting ? (result.correct ? "correct" : "incorrect") : "none";
  const audioTone: "neutral" | "incorrect" = headerStatus === "incorrect" ? "incorrect" : "neutral";
  // Per-option markers. Blue is shown ONLY on a correct answer (the chosen
  // option) — a wrong attempt never reveals the correct option. Coral marks only
  // the most-recent submitted-wrong option.
  const optionResult = {
    correctKey: result?.correct ? (value.choiceKey ?? null) : null,
    wrongKeys: wrongKey ? [wrongKey] : [],
  };
  const bookmarkButton = quiz && (
    <SaveBookmarkButton
      saved={saved}
      onToggle={toggleSave}
      label={saved ? topikCopy.removeSaved : topikCopy.saveQuestion}
    />
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
              onChange={handleChange}
              disabled={completed || submitting}
              copy={topikCopy}
              optionResult={optionResult}
              tone={audioTone}
            />

            {/* Writing answers show the score card; selection verdicts are carried
                by the header + the blue (correct) / coral (submitted-wrong) options. */}
            {result && isWriting && <TopikResult result={result} copy={topikCopy} />}

            {/* The CTA slot is always rendered so the vertically-centered card
                keeps its exact height when the completion sheet slides up — on a
                correct answer the Submit button is hidden (its space reserved),
                not removed, so the background never reflows/shifts. */}
            <div className="sess__cta" aria-hidden={completed}>
              <button
                className="sess__submit"
                onClick={submit}
                disabled={!canSubmitTopik(quiz, value) || submitting || completed}
                style={completed ? { visibility: "hidden" } : undefined}
              >
                {submitting ? (
                  <Spinner size={20} stroke={2.5} />
                ) : (
                  topikCopy.submit
                )}
              </button>
            </div>
          </div>
        )}
      </SessionChrome>

      {completed && !rewardOpen && (
        <ReviewCompleteSheet
          /* Reading, listening and writing reviews all get the same sheet: the
             left tile re-solves the item (다시 풀기 / "Retry"). There is no
             listening-only replay here — TAL-046 (674:10333) labels even a
             reading question 다시 듣기, so that wording was never a per-kind
             distinction, and the action has always been `restart`. */
          leftLabel={t("session.solveAgain")}
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
