import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "../i18n";
import { Screen } from "../components/layout/Screen";
import { ConfirmDialog } from "../components/ui/Modal";
import { EmptyState, LoadingState } from "../components/ui/states";
import { CharacterArt } from "../components/brand/ProfileAssets";
import { AskAiSheet } from "../components/AskAiSheet";
import { SpeakingCard } from "../components/lecture/SpeakingCard";
import type { SpeakingOutcome } from "../components/lecture/SpeakingCard";
import { learnApi, sentenceApi } from "../api/endpoints";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
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
  const { t } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const [idx, setIdx] = useState(0);
  const [outcome, setOutcome] = useState<SpeakingOutcome>("prompt");
  const [quitOpen, setQuitOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const lecture = useQuery({ queryKey: ["lecture", lectureId], queryFn: () => learnApi.lecture(lectureId) });
  const items = useQuery({ queryKey: ["speak-practice", lectureId], queryFn: () => learnApi.speakPractice(lectureId) });
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

  const body = items.isPending ? (
    <LoadingState />
  ) : items.isError ? (
    <EmptyState emoji="😢" title={errorMessage(items.error)} />
  ) : total === 0 ? (
    <EmptyState emoji="🎤" title={t("courses.noSpeakPractice")} />
  ) : (
    <div className="pqz-page">
      <span className="pqz-page__count">{t("courses.sentenceCount", { current: idx + 1, total })}</span>
      <button className="pqz-page__mascot" onClick={() => setAskOpen(true)} aria-label={t("courses.chatbotA11y")}>
        <CharacterArt variant="AVATAR_01" fill="100%" />
      </button>
      <div className="pqz-page__progress">
        <span style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>
      <div className="spk-page__card">
        {sentence.data ? (
          <SpeakingCard
            sentence={sentence.data}
            onOutcome={setOutcome}
            onMicDeclined={() => nav(-1)}
            prev={idx > 0 ? () => go(idx - 1) : undefined}
            next={idx < total - 1 ? () => go(idx + 1) : undefined}
          />
        ) : (
          <LoadingState />
        )}
      </div>

      {last && outcome !== "prompt" && (
        <div className="spk-page__bar">
          <button className="spk-page__tile" onClick={() => go(0)}>
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
    <Screen title={lecture.data?.title} back onBack={() => (total ? setQuitOpen(true) : nav(-1))} className="screen--practice">
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
