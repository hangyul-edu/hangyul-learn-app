import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { SavePlusIcon } from "../components/brand/HomeIcons";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, sentenceApi, dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { Sentence, SpeechAttempt } from "../lib/types";

/** Blue circular check for the correct-answer feedback card. */
function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill="#5D7CFF" />
      <path d="M7 12.5l3.2 3.2L17 8.8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Remaining items to satisfy today's conversation goal (server-derived). */
function useRemaining() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const t = q.data?.tracks.find((x) => x.category === "conversation");
  const remaining = t ? Math.max(t.goal.target - t.goal.current, 0) : 0;
  return { remaining, level: t?.level ?? 1 };
}

export function SessionConversation() {
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { remaining, level } = useRemaining();

  const [prompt, setPrompt] = useState("");
  const [items, setItems] = useState<Sentence[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [hintOpen, setHintOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [typed, setTyped] = useState("");
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [result, setResult] = useState<SpeechAttempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const media = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(Date.now());

  // Build (or regenerate) the set for the remaining daily goal. Regeneration
  // replaces the whole active set atomically only on success.
  async function loadSet(withPrompt?: string) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const count = Math.max(remaining || 0, 1);
      const res = await recApi.sentences({ count, ...(withPrompt ? { prompt: withPrompt } : {}) });
      setItems(res.items);
      setIdx(0);
      setCorrectSet(new Set());
      setAnswered(new Set());
      setResult(null);
      setTyped("");
      setHintOpen(false);
    } catch (e) {
      if (items === null) setError(true);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Initial fetch once the remaining goal is known.
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    void loadSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = items?.length ?? 0;
  const cur = items?.[idx];
  const progress = total ? answered.size / total : 0;

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

  function record(res: SpeechAttempt, s: Sentence) {
    setResult(res);
    setAnswered((a) => new Set(a).add(s.sentence_id));
    // Points come from the server result; correct count from its `correct` flag.
    setPoints((p) => p + (res.points_earned ?? 0));
    if (res.correct) setCorrectSet((c) => new Set(c).add(s.sentence_id));
  }

  async function startRec(s: Sentence) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setScoring(true);
        try {
          const blob = new Blob(chunks.current, { type: "audio/webm" });
          record(await sentenceApi.speechAttempt(s.sentence_id, blob, "attempt.webm"), s);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setScoring(false);
        }
      };
      media.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      toast.error("마이크 권한이 필요해요. 브라우저 설정을 확인해 주세요.");
    }
  }

  function next() {
    setResult(null);
    setTyped("");
    setHintOpen(false);
    if (idx >= total - 1) {
      finishOrExit();
    } else {
      setIdx((i) => i + 1);
    }
  }

  // Show the summary only if ≥1 item was correct; otherwise return via the
  // normal exit flow. Used by the CTA at completion AND the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  function exitSession() {
    // Record the personalized session on the way out. This is what finalizes a
    // pending level-up AND (when the session earned points) creates the
    // "학습 완료! +Np 적립" notification. Best-effort — never block the exit.
    if (answered.size > 0) {
      const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      learnApi
        .recordSession({ session_type: "sentence", category: "conversation", duration_seconds })
        .then(() => qc.invalidateQueries({ queryKey: ["notif-unread"] }))
        .catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    nav(-1);
  }

  const incorrect = !!result && cur != null && answered.has(cur.sentence_id) && !result.correct;

  const panel = useMemo(
    () => (
      <div className="sess__prompt">
        <input
          className="sess__prompt-input"
          placeholder="✨ 원하는 상황을 입력하면 맞춤 문장을 추천해드려요"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          aria-label="맞춤 문장 상황 입력"
        />
        <button
          className="sess__prompt-send"
          onClick={() => prompt.trim() && loadSet(prompt.trim())}
          disabled={!prompt.trim() || busy}
          aria-label="맞춤 문장 추천 받기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12l16-7-7 16-2.5-6.5L4 12z" stroke="#8a929a" strokeWidth="1.7" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prompt, busy],
  );

  return (
    <>
    <SessionChrome
      title={`회화 Lv.${level}`}
      heading="목표 하루 학습 문장"
      correct={correctSet.size}
      total={total}
      progress={progress}
      panel={panel}
      onBack={finishOrExit}
      askContext={
        !cur
          ? null
          : incorrect && result
            ? { contextKind: "speech_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
            : { contextKind: "sentence", contextId: cur.sentence_id, autoExplain: false, bubble: false }
      }
    >
      {error ? (
        <ErrorState message="문장을 불러오지 못했어요." onRetry={() => loadSet()} />
      ) : !cur ? (
        <LoadingState />
      ) : result?.correct ? (
        /* Correct-answer feedback state: interactive controls replaced by the
           completed blue card. Counter/progress already updated in record(). */
        <>
          <div className="sess__card sess__card--conv sess__card--correct">
            <div className="sess__card-top">
              <div className="sess__correct-head">
                <span className="sess__check">
                  <CheckIcon />
                </span>
                <span>정답이에요!</span>
              </div>
              <button className="sess__bookmark" onClick={() => toggleSave(cur)} aria-label={saved[cur.sentence_id] ? "저장 해제" : "저장"} aria-pressed={!!saved[cur.sentence_id]}>
                <SavePlusIcon active={!!saved[cur.sentence_id]} />
              </button>
            </div>
            <div className="sess__sentence sess__sentence--correct" role="status" aria-label={`정답입니다. ${cur.korean}. ${cur.translation}`}>
              {cur.korean}
            </div>
            <div className="sess__trans">{cur.translation}</div>
          </div>

          <div className="sess__mic-wrap">
            {/* Item is locked once answered — no second evaluation. */}
            <button className="sess__mic" disabled aria-label="이 문제는 완료되었어요">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="#FF5B00" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#FF5B00" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <button className="sess__next" onClick={next}>
            {idx >= total - 1 ? "완료" : "다음"}
          </button>
        </>
      ) : (
        <>
          <div className={`sess__card sess__card--conv ${result ? "sess__card--incorrect" : ""}`}>
            <div className="sess__card-top">
              <p className="sess__instr">빈칸을 채워 완성해봐요✨</p>
              <button className="sess__bookmark" onClick={() => toggleSave(cur)} aria-label={saved[cur.sentence_id] ? "저장 해제" : "저장"} aria-pressed={!!saved[cur.sentence_id]}>
                <SavePlusIcon active={!!saved[cur.sentence_id]} />
              </button>
            </div>

            <div className="sess__sentence">{cur.korean}</div>
            <div className="sess__trans">{cur.translation}</div>

            {keyboard && (
              <input
                className="sess__answer"
                placeholder="들리는 대로 입력해보세요"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                aria-label="답 입력"
              />
            )}
            {hintOpen && cur.romanization && <p className="sess__hint">💡 {cur.romanization}</p>}

            <div className="sess__card-actions">
              <button className="sess__chip" onClick={() => setHintOpen((h) => !h)}>
                <span aria-hidden="true">❔</span> 힌트보기
              </button>
              <button className="sess__chip" onClick={() => setKeyboard((k) => !k)} aria-pressed={keyboard}>
                <span aria-hidden="true">⌨</span> 키보드 모드
              </button>
            </div>
          </div>

          {result ? (
            <div className="sess__result">
              <span className="sess__result-no">
                조금 더 연습해요 💪 · {result.pronunciation_score}점
              </span>
              <button className="sess__next" onClick={next}>
                {idx >= total - 1 ? "완료" : "다음"}
              </button>
            </div>
          ) : (
            <div className="sess__mic-wrap">
              {recording ? (
                <button className="sess__mic is-rec" onClick={() => media.current?.stop()} aria-label="녹음 멈추기">
                  ■
                </button>
              ) : (
                <button className="sess__mic" onClick={() => startRec(cur)} disabled={scoring} aria-label="따라 말하기">
                  {scoring ? <span className="spinner" style={{ width: 26, height: 26 }} /> : (
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" fill="#FF5B00" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="#FF5B00" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </SessionChrome>
    {completed && (
      <SessionCompleteModal mode="conversation" correctCount={correctSet.size} points={points} onConfirm={exitSession} />
    )}
    </>
  );
}
