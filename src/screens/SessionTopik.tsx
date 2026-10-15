import { useTranslation } from "../i18n";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { TopikQuestion } from "../components/topik/TopikQuestion";
import { TopikResult } from "../components/topik/TopikResult";
import { ResultHeader, type ResultStatus } from "../components/topik/ResultHeader";
import { SaveBookmarkButton } from "../components/SaveBookmarkButton";
import { LoadingState, ErrorState, Spinner } from "../components/ui/states";
import { isStudyItem, revealedChoiceKey } from "../lib/studySession";
import { useTopikSessionCopy } from "../lib/topikSessionCopy";
import { TopikTypeDropdown } from "./sessionTopik/TopikTypeDropdown";
import { useTopikSession } from "./sessionTopik/useTopikSession";

/** The daily TOPIK session for one part: see useTopikSession for the flow. */
export function SessionTopik() {
  const { t } = useTranslation();
  const copy = useTopikSessionCopy();
  // Completion sheet reuses the Review-Learning bottom sheet verbatim (다시 시작 / 완료).
  const reviewCopy = useReviewSessionCopy();
  const s = useTopikSession();
  const { cur, phase, result } = s;

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
      ? { correctKey: s.value.choiceKey ?? null, wrongKeys: s.wrongKeys }
      : phase === "revealed" && isStudyItem(cur)
        ? { correctKey: revealedChoiceKey(cur.reveal), wrongKeys: s.wrongKeys }
        : { correctKey: null, wrongKeys: s.wrongKeys };
  // The question is finished (Next / completion sheet): answered correctly,
  // or closed with the answer shown.
  const resolved = phase === "correct" || phase === "revealed";
  const explain = phase === "incorrect" || phase === "revealed";

  return (
    <>
      <SessionChrome
        title={t("session.topikGrade", { n: s.grade })}
        heading={t("session.dailyQuestionGoal")}
        correct={s.progress.current}
        total={s.progress.total}
        progress={s.progress.ratio}
        panel={
          <TopikTypeDropdown
            options={s.typeOptions}
            value={s.typeCode}
            open={s.typesOpen}
            onOpenChange={s.setTypesOpen}
            onSelect={s.selectType}
          />
        }
        onBack={s.finishOrExit}
        askContext={
          !cur
            ? null
            : isStudyItem(cur) && s.study
              ? // The grounded tutor: hints while the item is open, explanations after.
                { contextKind: "study_activity", sessionId: s.study.sessionId, contextId: cur.activity_id, autoExplain: explain, bubble: explain }
              : phase === "incorrect" && result
                ? { contextKind: "quiz_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
                : { contextKind: "quiz", contextId: cur.quiz_id, autoExplain: false, bubble: false }
        }
      >
        {s.error ? (
          <ErrorState message={t("session.questionLoadError")} onRetry={s.retryLoad} />
        ) : !cur ? (
          <LoadingState />
        ) : (
          <div className="sess__card sess__card--topik">
            <ResultHeader
              status={headerStatus}
              title={copy.title}
              copy={copy}
              bookmark={
                <SaveBookmarkButton
                  saved={!!s.saved[cur.quiz_id]}
                  onToggle={() => s.toggleSave(cur)}
                  label={s.saved[cur.quiz_id] ? copy.removeSaved : copy.saveQuestion}
                />
              }
              incorrectTitle={phase === "revealed" ? t("session.topikAnswerRevealedTitle") : undefined}
            />

            <TopikQuestion
              quiz={cur}
              value={s.value}
              onChange={s.setValue}
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
                s.isLastStep ? null : (
                  <button className="sess__next" onClick={s.next}>
                    {copy.next}
                  </button>
                )
              ) : (
                <button className="sess__submit" onClick={s.submit} disabled={!s.canSubmit}>
                  {phase === "submitting" ? <Spinner size={20} stroke={2.5} /> : copy.submit}
                </button>
              )}
            </div>
          </div>
        )}
      </SessionChrome>
      {/* Bottom-up completion sheet on the final correct answer — identical to the
          one TOPIK Review Learning shows: 다시 시작 (redo the set) + 완료 (finalize,
          opening the summary modal). */}
      {resolved && s.isLastStep && !s.completed && cur != null && (
        <ReviewCompleteSheet
          /* TAL-018 (673:13337) labels this 다시 풀기, not the review flow's 다시 시작. */
          leftLabel={t("session.solveAgain")}
          onLeft={s.restartSession}
          onComplete={s.next}
          copy={reviewCopy}
        />
      )}
      {s.completed && (
        <SessionCompleteModal mode="topik" correctCount={s.correctCount} points={s.points} onConfirm={s.exitSession} />
      )}
    </>
  );
}
