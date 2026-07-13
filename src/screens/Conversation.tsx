import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button, Chip } from "../components/ui/kit";
import { Sheet } from "../components/ui/Modal";
import { Async, EmptyState, LoadingState } from "../components/ui/states";
import { sentenceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { Page, Sentence, SpeechAttempt } from "../lib/types";

const LEVELS = [1, 2, 3, 4, 5];

export function Conversation() {
  const toast = useToast();
  const [level, setLevel] = useState(1);
  const [idx, setIdx] = useState(0);
  const [showRoman, setShowRoman] = useState(false);
  const [showTrans, setShowTrans] = useState(true);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<SpeechAttempt | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const q = useQuery({
    queryKey: ["sentences", level],
    queryFn: () => sentenceApi.list({ level, limit: 20 }),
  });

  const items = q.data?.items ?? [];
  const cur = items[idx];

  async function playAudio(s: Sentence) {
    try {
      const { url } = await sentenceApi.audio(s.sentence_id);
      await new Audio(url).play();
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

  async function startRec(s: Sentence) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setScoring(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const res = await sentenceApi.speechAttempt(s.sentence_id, blob, "attempt.webm");
          setResult(res);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setScoring(false);
        }
      };
      mediaRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.");
    }
  }

  function next() {
    setResult(null);
    setIdx((i) => Math.min(i + 1, items.length - 1));
  }

  return (
    <Screen title="회화 학습" back>
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
            레벨 {l}
          </Chip>
        ))}
      </div>

      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        isEmpty={(d: Page<Sentence>) => d.items.length === 0}
        empty={<EmptyState emoji="📭" title="이 레벨엔 문장이 없어요" text="다른 레벨을 선택해 보세요." />}
      >
        {() =>
          cur ? (
            <div className="stack" style={{ gap: 16 }}>
              <div className="row row--between">
                <span className="muted" style={{ fontSize: 13 }}>
                  {idx + 1} / {items.length}
                </span>
                <div className="row" style={{ gap: 6 }}>
                  <Chip active={showRoman} onClick={() => setShowRoman((v) => !v)}>발음</Chip>
                  <Chip active={showTrans} onClick={() => setShowTrans((v) => !v)}>번역</Chip>
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
                {recording ? (
                  <Button variant="danger" block onClick={() => mediaRef.current?.stop()}>
                    ● 녹음 멈추기
                  </Button>
                ) : (
                  <Button block loading={scoring} leftIcon="🎙️" onClick={() => startRec(cur)}>
                    따라 말하기
                  </Button>
                )}
              </div>

              <div className="row" style={{ justifyContent: "space-between" }}>
                <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
                  ‹ 이전
                </Button>
                <Button variant="ghost" size="sm" disabled={idx >= items.length - 1} onClick={next}>
                  다음 ›
                </Button>
              </div>
            </div>
          ) : (
            <LoadingState />
          )
        }
      </Async>

      <Sheet open={!!result} onClose={() => setResult(null)} title="발음 평가">
        {result && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="center">
              <div className="big-num" style={{ fontSize: 52, color: result.correct ? "var(--success)" : "var(--warning)" }}>
                {result.pronunciation_score}
              </div>
              <div className="muted">점 · {result.correct ? "훌륭해요! 👏" : "조금 더 연습해요 💪"}</div>
            </div>
            {result.transcription && (
              <div className="card card--flat" style={{ background: "var(--surface-2)" }}>
                <div className="dim" style={{ fontSize: 12, marginBottom: 4 }}>내가 말한 내용</div>
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
              <div className="center"><span className="badge badge--brand">⚡ +{result.points_earned} 포인트</span></div>
            )}
            <Button block onClick={next}>
              다음 문장 →
            </Button>
          </div>
        )}
      </Sheet>
    </Screen>
  );
}
