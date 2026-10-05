import { useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button, Chip } from "../components/ui/kit";
import { Sheet } from "../components/ui/Modal";
import { Async, EmptyState, LoadingState } from "../components/ui/states";
import { sentenceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { errorMessage } from "../lib/http";
import { speechErrorMessage, type RecordingInfo } from "../lib/recording";
import { playOn, unlockedAudio } from "../lib/unlockedAudio";
import type { Page, Sentence, SpeechAttempt } from "../lib/types";

const LEVELS = [1, 2, 3, 4, 5];

export function Conversation() {
  const { t } = useTranslation();
  const toast = useToast();
  const [level, setLevel] = useState(1);
  const [idx, setIdx] = useState(0);
  const [showRoman, setShowRoman] = useState(false);
  const [showTrans, setShowTrans] = useState(true);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<SpeechAttempt | null>(null);
  // The sentence the take was started for — bound at start, so a take is
  // always graded against the item the learner was actually reading.
  const recordingForRef = useRef<Sentence | null>(null);
  const recorder = useVoiceRecorder({
    onRecorded: (audio, take) => {
      const sentence = recordingForRef.current;
      if (sentence) void gradeRecording(sentence, audio, take);
    },
    onUnavailable: () => toast.error(t("study.micPermission")),
  });

  const q = useQuery({
    queryKey: ["sentences", level],
    queryFn: () => sentenceApi.list({ level, limit: 20 }),
  });

  const items = q.data?.items ?? [];
  const cur = items[idx];
  // The sentence on screen counts as study (streak + learning day + the sun),
  // recorded once per local day and silently.
  useRecordDisplayedItem("conversation", cur?.sentence_id);

  async function playAudio(s: Sentence) {
    // Unlocked inside the tap, before the URL fetch (iOS).
    const audio = unlockedAudio();
    try {
      const { url } = await sentenceApi.audio(s.sentence_id);
      await playOn(audio, url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function toggleSave(s: Sentence) {
    const on = saved[s.sentence_id];
    setSaved((m) => ({ ...m, [s.sentence_id]: !on }));
    try {
      if (on) await sentenceApi.unbookmark(s.sentence_id);
      else await sentenceApi.bookmark(s.sentence_id);
    } catch (e) {
      setSaved((m) => ({ ...m, [s.sentence_id]: on }));
      toast.error(errorMessage(e));
    }
  }

  async function gradeRecording(sentence: Sentence, audio: Blob, take: RecordingInfo) {
    setScoring(true);
    try {
      setResult(await sentenceApi.speechAttempt(sentence.sentence_id, audio, take));
    } catch (e) {
      toast.error(speechErrorMessage(e));
    } finally {
      setScoring(false);
    }
  }

  function next() {
    setResult(null);
    setIdx((i) => Math.min(i + 1, items.length - 1));
  }

  return (
    <Screen title={t("study.conversationTitle")} back>
      <div className="chiprow" style={{ marginBottom: 14 }}>
        {LEVELS.map((l) => (
          <Chip
            key={l}
            active={level === l}
            onClick={() => {
              setLevel(l);
              setIdx(0);
              setResult(null);
            }}
          >
            {t("session.levelLabel", { n: l })}
          </Chip>
        ))}
      </div>

      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        isEmpty={(d: Page<Sentence>) => d.items.length === 0}
        empty={<EmptyState emoji="📭" title={t("study.noSentences")} text={t("study.tryAnotherLevel")} />}
      >
        {() =>
          cur ? (
            <div className="stack" style={{ gap: 16 }}>
              <div className="row row--between">
                <span className="muted" style={{ fontSize: 13 }}>
                  {idx + 1} / {items.length}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <Chip active={showRoman} onClick={() => setShowRoman((v) => !v)}>{t("study.pronunciation")}</Chip>
                  <Chip active={showTrans} onClick={() => setShowTrans((v) => !v)}>{t("study.translation")}</Chip>
                </div>
              </div>

              <div className="card card--pad-lg" style={{ minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12, textAlign: "center" }}>
                <button
                  className="topbar__btn"
                  style={{ width: 48, height: 48, margin: "0 auto", background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 22 }}
                  onClick={() => playAudio(cur)}
                >
                  🔊
                </button>
                <div className="hangul-lg" style={{ fontSize: 26, lineHeight: 1.4 }}>{cur.korean}</div>
                {showRoman && cur.romanization && <div className="dim" style={{ fontSize: 15 }}>{cur.romanization}</div>}
                {showTrans && <div className="muted" style={{ fontSize: 15 }}>{cur.translation}</div>}
              </div>

              <div className="row" style={{ gap: 10 }}>
                <Button variant="ghost" onClick={() => toggleSave(cur)} style={{ flex: "0 0 56px" }}>
                  {saved[cur.sentence_id] ? "🔖" : "📑"}
                </Button>
                {recorder.recording ? (
                  <Button variant="danger" block onClick={recorder.stop}>
                    {t("study.stopRecording")}
                  </Button>
                ) : (
                  <Button
                    block
                    loading={scoring}
                    leftIcon="🎙️"
                    onClick={() => {
                      recordingForRef.current = cur;
                      void recorder.start();
                    }}
                  >
                    {t("study.speak")}
                  </Button>
                )}
              </div>

              <div className="row" style={{ justifyContent: "space-between" }}>
                <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                  {t("study.prev")}
                </Button>
                <Button variant="ghost" size="sm" disabled={idx >= items.length - 1} onClick={next}>
                  {t("study.next")}
                </Button>
              </div>
            </div>
          ) : (
            <LoadingState />
          )
        }
      </Async>

      <Sheet open={!!result} onClose={() => setResult(null)} title={t("study.pronunciationEval")}>
        {result && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="center">
              <div className="big-num" style={{ fontSize: 52, color: result.correct ? "var(--success)" : "var(--warning)" }}>
                {result.pronunciation_score}
              </div>
              <div className="muted">{t("study.points")} · {t(result.correct ? "session.excellent" : "study.practiceMore")}</div>
            </div>
            {result.transcription && (
              <div className="card card--flat" style={{ background: "var(--surface-2)" }}>
                <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>{t("study.mySpeech")}</div>
                <div style={{ fontWeight: 600 }}>{result.transcription}</div>
              </div>
            )}
            {result.tips?.map((t, i) => (
              <div key={i} className="row" style={{ alignItems: "flex-start", gap: 8, fontSize: 13.5 }}>
                <span>💡</span>
                <span className="muted">{t}</span>
              </div>
            ))}
            {typeof result.points_earned === "number" && result.points_earned > 0 && (
              <div className="center"><span className="badge badge--brand">{t("session.pointsEarned", { points: result.points_earned })}</span></div>
            )}
            <Button block onClick={next}>
              {t("study.nextSentence")}
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
