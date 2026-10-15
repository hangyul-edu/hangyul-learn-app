import { useTranslation } from "../i18n";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { CorrectAnswerSheet } from "../components/CorrectAnswerSheet";
import { ReviewCompleteSheet } from "../components/ReviewCompleteSheet";
import { ReviewRewardModal } from "../components/ReviewRewardModal";
import { useReviewSessionCopy } from "../lib/reviewSessionCopy";
import { LoadingState, ErrorState } from "../components/ui/states";
import { isStudyItem } from "../lib/studySession";
import { AnswerSentenceCard, SolvedSentenceCard } from "../components/session/ConversationCards";
import { pronunciationMessage } from "./sessionConversation/attempts";
import { CustomPrompt } from "./sessionConversation/CustomPrompt";
import { useConversationSession } from "./sessionConversation/useConversationSession";

/** The daily conversation session (and, at /review/sentence/:id, the
 * single-sentence review): see useConversationSession for the flow. */
export function SessionConversation() {
  const { t } = useTranslation();
  const reviewCopy = useReviewSessionCopy();
  const s = useConversationSession();
  const { cur, result, isReview } = s;

  const incorrect = !!result && cur != null && !result.correct;
  // The pronunciation panel is voice-only. It stays tied to the attempt history
  // (`attemptMode`) but hides while the keyboard input mode is active — switching
  // to keyboard changes the visible state without discarding the attempt.
  const showPron = incorrect && s.attemptMode === "voice" && !s.keyboard;
  // Hint chip state for the current item: undefined → 힌트보기, "hint" → 정답보기,
  // "answer" → chip hidden. A hint is shown once any stage is set.
  const curStage = cur ? s.hintStage[cur.sentence_id] : undefined;
  const hintShown = curStage != null;
  const bookmark = cur && { saved: !!s.saved[cur.sentence_id], onToggle: () => s.toggleSave(cur) };

  return (
    <>
      <SessionChrome
        title={isReview ? reviewCopy.sentenceTitle : t("sessionConversation.levelTitle", { level: s.level })}
        heading={t("session.dailySentenceGoal")}
        correct={s.correctCount}
        total={s.total}
        progress={s.progress}
        panel={<CustomPrompt value={s.prompt} onChange={s.setPrompt} onSubmit={s.customize} busy={s.busy} />}
        minimal={isReview}
        onBack={isReview ? s.backToSaved : s.finishOrExit}
        askContext={
          !cur
            ? null
            : isStudyItem(cur) && s.study
              ? // The grounded tutor: hints while the item is open, explanations after.
                { contextKind: "study_activity", sessionId: s.study.sessionId, contextId: cur.activity_id, autoExplain: incorrect, bubble: incorrect }
              : incorrect && result
                ? { contextKind: "speech_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
                : { contextKind: "sentence", contextId: cur.sentence_id, autoExplain: false, bubble: false }
        }
      >
        {s.error ? (
          <ErrorState message={t("session.sentenceLoadError")} onRetry={s.retryLoad} />
        ) : !cur || !bookmark ? (
          <LoadingState />
        ) : result?.correct ? (
          /* Correct-answer feedback state: interactive controls replaced by the
             completed blue card. Counter/progress already updated on record. */
          <SolvedSentenceCard sentence={cur} bookmark={bookmark} />
        ) : (
          <AnswerSentenceCard
            sentence={cur}
            copy={s.copy}
            incorrect={incorrect}
            bookmark={bookmark}
            revealedText={hintShown ? (s.revealed[cur.sentence_id] ?? "") : ""}
            pronunciation={
              showPron && result ? { score: result.pronunciation_score, message: pronunciationMessage(result, s.copy) } : null
            }
            hint={{
              stage: curStage,
              busy: s.hintBusy,
              disabled: s.answered.has(cur.sentence_id),
              onReveal: () => s.onHint(cur),
            }}
            answer={{
              keyboard: s.keyboard,
              onToggleKeyboard: s.toggleKeyboard,
              typed: s.typed,
              onTyped: s.setTyped,
              onSubmit: () => s.submitTyped(cur),
              submitting: s.submitting,
              composingRef: s.composingRef,
            }}
            voice={{
              recording: s.recording,
              scoring: s.scoring,
              onStart: () => s.startVoice(cur),
              onStop: s.stopVoice,
            }}
          />
        )}
      </SessionChrome>
      {/* Correct-answer bottom sheet. Intermediate (다시 시작 / 다음, no blur) vs
          final (다시 시작 / 완료, blurred background). The mode is derived from the
          session's own item state, not a hardcoded count. The left tile re-arms
          this item — the same action the review sheet runs — never audio replay. */}
      {cur != null && result?.correct && !s.completed && !isReview && (
        <CorrectAnswerSheet
          mode={s.idx >= s.total - 1 ? "complete" : "next"}
          onRetry={() => s.retryItem(cur)}
          onNext={s.next}
          onComplete={s.next}
        />
      )}
      {/* Review completion: a two-button sheet (다시 시작 / 완료), then the reward modal. */}
      {cur != null && result?.correct && isReview && !s.rewardOpen && (
        <ReviewCompleteSheet
          leftLabel={reviewCopy.restart}
          onLeft={() => s.retryItem(cur)}
          onComplete={() => s.setRewardOpen(true)}
          copy={reviewCopy}
        />
      )}
      {isReview && s.rewardOpen && result?.correct && (
        <ReviewRewardModal
          // The session total (accumulated across every correct attempt, kept
          // across a restart), NOT the last attempt — a deduped re-answer after a
          // restart earns 0, but the session's real total must still be shown.
          points={s.points}
          copy={reviewCopy}
          onConfirm={s.backToSaved}
        />
      )}
      {s.completed && !isReview && (
        <SessionCompleteModal mode="conversation" correctCount={s.correctCount} points={s.points} onConfirm={s.exitSession} />
      )}
    </>
  );
}
