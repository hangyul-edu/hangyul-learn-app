import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { Screen } from "../components/layout/Screen";
import { ConfirmDialog } from "../components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/states";
import { DetailHeader } from "../components/DetailHeader";
import { AskMascot } from "../components/lecture/AskMascot";
import { AskAiSheet } from "../components/AskAiSheet";
import { SpeakingCard } from "../components/lecture/SpeakingCard";
import type { SpeakingOutcome } from "../components/lecture/SpeakingCard";
import { learnApi, sentenceApi } from "../api/endpoints";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { isSubscriptionRequired, useLeaveLockedLecture } from "../hooks/premiumLecture";
import { errorMessage } from "../lib/http";

/**
 * Repeat-after-me practice for one lecture — COU-014 (511:8840), perfect
 * COU-015 (511:9151), last sentence COU-016 (511:9450). Opened from the mic on
 * a conversation lecture's row; the sentences are the lecture's speaking
 * checkpoints, in playback order.
 *
 * ‹ › move between sentences; on the last one, once it has been tried, the
 * bottom bar offers 다시 시작 (back to the first) and 완료. Leaving early asks
 * first (511:9565).
 */
export function SpeakPractice() {
  const { t, language } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  // Bumped by 다시 시작 so the card starts over — prompt state, listening —
  // even when the practice is already on its first sentence (a lesson with
  // one checkpoint), where moving to sentence 1 changed nothing and only
  // hid the bar, leaving the card's own 다시하기 to be tapped as well.
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<SpeakingOutcome>("prompt");
  const [quitOpen, setQuitOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  // A refusal (402: a premium lecture without premium access) is final.
  const retry = (n: number, e: unknown) => !isSubscriptionRequired(e) && n < 2;
  const lecture = useQuery({ queryKey: ["lecture", lectureId, language], queryFn: () => learnApi.lecture(lectureId, language), retry });
  const items = useQuery({ queryKey: ["speak-practice", lectureId], queryFn: () => learnApi.speakPractice(lectureId), retry });
  // A premium lecture's checkpoint sentences reached by a direct link: leave
  // with the subscription notice, as the series page's tap would have.
  const refused = isSubscriptionRequired(lecture.error) || isSubscriptionRequired(items.error);
  useLeaveLockedLecture(refused);
  const sentenceId = items.data?.items[idx]?.sentence_id;
  const sentence = useQuery({
    queryKey: ["sentence", sentenceId],
    queryFn: () => sentenceApi.get(sentenceId!),
    enabled: !!sentenceId,
  });
  // The sentence on screen counts as study, once per local day.
  useRecordDisplayedItem("conversation", sentence.data?.sentence_id);

  const total = items.data?.items.length ?? 0;
  const last = total > 0 && idx === total - 1;

  function go(next: number) {
    setOutcome("prompt");
    setIdx(next);
  }

  function restart() {
    setRound((r) => r + 1);
    go(0);
  }

  const body = items.isPending || refused ? (
    <LoadingState />
  ) : items.isError ? (
    <EmptyState emoji="😢" title={errorMessage(items.error)} />
  ) : total === 0 ? (
    <EmptyState emoji="🎤" title={t("courses.noSpeakPractice")} />
  ) : (
    <div className="pqz-page">
      <span className="pqz-page__count">{t("courses.sentenceCount", { current: idx + 1, total })}</span>
      {/* 511:9103 — the 45px mascot disc, ringed like every chatbot button. */}
      <button className="pqz-page__mascot" onClick={() => setAskOpen(true)} aria-label={t("courses.chatbotA11y")}>
        <AskMascot />
      </button>
      <div className="pqz-page__progress">
        <span style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <div className="spk-page__card">
        {sentence.data ? (
          <SpeakingCard
            key={`${round}-${sentence.data.sentence_id}`}
            sentence={sentence.data}
            onOutcome={setOutcome}
            onMicDeclined={() => nav(-1)}
            prev={idx > 0 ? () => go(idx - 1) : undefined}
            next={idx < total - 1 ? () => go(idx + 1) : undefined}
          />
        ) : sentence.isError ? (
          <ErrorState message={errorMessage(sentence.error)} onRetry={() => void sentence.refetch()} />
        ) : (
          <LoadingState />
        )}
      </div>

      {last && (outcome === "correct" || outcome === "wrong") && (
        <div className="spk-page__bar">
          <button className="spk-page__tile" onClick={restart}>
            {t("courses.restart")}
          </button>
          <button className="spk-page__tile spk-page__tile--done" onClick={() => nav(-1)}>
            {t("courses.finish")}
          </button>
        </div>
      )}

      {sentence.data && (
        <AskAiSheet
          key={sentence.data.sentence_id}
          open={askOpen}
          context={{ contextKind: "sentence", contextId: sentence.data.sentence_id, autoExplain: false, bubble: false }}
          onClose={() => setAskOpen(false)}
        />
      )}
    </div>
  );

  return (
    <Screen
      className="screen--practice"
      header={
        <DetailHeader
          className="topnav--practice"
          title={lecture.data?.title ?? ""}
          onBack={() => (total ? setQuitOpen(true) : nav(-1))}
        />
      }
    >
      {body}
      <ConfirmDialog
        open={quitOpen}
        title={t("courses.practiceQuitTitle")}
        text={t("courses.practiceQuitText")}
        cancelLabel={t("courses.keepGoing")}
        confirmLabel={t("courses.stopHere")}
        onCancel={() => setQuitOpen(false)}
        onConfirm={() => nav(-1)}
      />
    </Screen>
  );
}
