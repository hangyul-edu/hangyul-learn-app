import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { SavePlusIcon } from "../components/brand/HomeIcons";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, sentenceApi, dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { BlankAttempt, Sentence, SpeechAttempt } from "../lib/types";

/** A conversation item is a fill-in-the-blank when it ships a `display_text`
 * with a blank and structured blank metadata. */
function hasBlank(s: Sentence): boolean {
  return !!s.display_text && s.display_text.includes("___") && (s.blanks?.length ?? 0) > 0;
}

/** Map the fill-in-the-blank result onto the existing SpeechAttempt feedback
 * shape so the correct/incorrect/progress UI is reused unchanged. */
function blankToSpeech(b: BlankAttempt): SpeechAttempt {
  return {
    attempt_id: b.attempt_id,
    correct: b.is_correct,
    transcription: b.transcription ?? b.normalized_answer,
    target_text: b.completed_sentence,
    pronunciation_score: b.is_correct ? 100 : 0,
    feedback_code: b.is_correct ? "correct" : "missed_words",
    points_earned: b.points_earned,
    daily_progress: b.daily_progress ?? null,
  };
}

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Renders `display_text` as one inline sentence: prefix text, the mint blank
 * (a revealed-hint chip in voice mode, or an inline text input in keyboard
 * mode), then suffix text. Falls back to the full sentence when there is no
 * blank. Never renders the answer. */
function FillSentence({
  sentence,
  keyboard,
  typed,
  onTyped,
  revealed,
  onSubmit,
  submitting,
  composingRef,
}: {
  sentence: Sentence;
  keyboard: boolean;
  typed: string;
  onTyped: (v: string) => void;
  revealed: string;
  onSubmit: () => void;
  submitting: boolean;
  composingRef: React.MutableRefObject<boolean>;
}) {
  if (!hasBlank(sentence)) {
    return <div className="sess__sentence">{sentence.korean}</div>;
  }
  const parts = (sentence.display_text ?? "").split("___");
  const widthEm = sentence.blanks?.[0]?.display_width_em ?? 6;
  return (
    <div className="sess__sentence sess__sentence--fill">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 &&
            (keyboard ? (
              <span className="sess__blank sess__blank--edit">
                {revealed && <span className="sess__blank-rev" aria-hidden="true">{revealed}</span>}
                <input
                  className="sess__blank-input"
                  style={{ width: `${widthEm}em` }}
                  value={typed}
                  onChange={(e) => onTyped(e.target.value)}
                  onCompositionStart={() => (composingRef.current = true)}
                  onCompositionEnd={() => (composingRef.current = false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !composingRef.current) {
                      e.preventDefault();
                      onSubmit();
                    }
                  }}
                  disabled={submitting}
                  autoFocus
                  lang="ko"
                  enterKeyHint="done"
                  aria-label="빈칸에 들어갈 말"
                />
              </span>
            ) : (
              <span
                className="sess__blank"
                style={{ minWidth: `${widthEm}em` }}
                aria-label={revealed ? `힌트: ${revealed}` : "빈칸"}
              >
                {revealed || " "}
              </span>
            ))}
        </span>
      ))}
    </div>
  );
}

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
  const loc = useLocation();
  const toast = useToast();
  const qc = useQueryClient();
  // Where the session was launched from (Home / Personalized), forwarded to the
  // Level-Up screen so its button returns the user to that source page.
  const from = (loc.state as { from?: string } | null)?.from ?? "/home";
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
  // Per-sentence server-revealed hint prefix (persists across mode switches /
  // rerenders for the current item).
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const composingRef = useRef(false); // true while a Korean IME composition is active
  const reqIdRef = useRef<string | null>(null); // idempotency key for the current item's attempt
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
      setRevealed({});
      reqIdRef.current = null;
      // Seed bookmark state from the server's saved flag on each item.
      setSaved(
        Object.fromEntries(res.items.map((s) => [s.sentence_id, !!(s.bookmarked ?? s.is_saved)])),
      );
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
  // Note: opening/viewing a sentence does NOT count as learning. Today is only
  // credited as a learning day once the user answers a sentence correctly —
  // that happens server-side on the correct attempt, and the sun refreshes when
  // the dashboard query is invalidated on session exit.

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

  // Keyboard-mode submit. Combines any server-revealed hint prefix with the
  // typed remainder, guards empty/whitespace + duplicate/in-flight + IME
  // composition, and funnels the result into the shared feedback flow.
  async function submitTyped(s: Sentence) {
    if (submitting || composingRef.current || answered.has(s.sentence_id)) return;
    const answerText = ((revealed[s.sentence_id] ?? "") + typed).trim();
    if (!answerText) return;
    setSubmitting(true);
    reqIdRef.current ??= newRequestId();
    try {
      const res = await sentenceApi.blankAttempt(s.sentence_id, {
        inputMode: "keyboard",
        answerText,
        clientRequestId: reqIdRef.current,
      });
      record(blankToSpeech(res), s);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  // Reveal the next leading character of the answer — server-controlled.
  async function requestHint(s: Sentence) {
    if (hintBusy || answered.has(s.sentence_id)) return; // single in-flight request
    setHintBusy(true);
    try {
      const current = revealed[s.sentence_id] ?? "";
      const res = await sentenceApi.blankHint(s.sentence_id, current.length);
      setRevealed((m) => ({ ...m, [s.sentence_id]: res.revealed_text }));
      setHintOpen(true);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setHintBusy(false);
    }
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
          if (hasBlank(s)) {
            // Voice fill-in-the-blank: accepts the missing phrase OR the full
            // completed sentence — graded server-side.
            reqIdRef.current ??= newRequestId();
            const res = await sentenceApi.blankAttempt(s.sentence_id, {
              inputMode: "voice",
              audio: blob,
              clientRequestId: reqIdRef.current,
            });
            record(blankToSpeech(res), s);
          } else {
            record(await sentenceApi.speechAttempt(s.sentence_id, blob, "attempt.webm"), s);
          }
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
    reqIdRef.current = null; // fresh idempotency key for the next item
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

  // Single exit path for both 완료 (modal confirm) and the back chevron. It
  // finalizes the personalized session on the server (source of truth): points
  // notification is created, and a level-up — if the server says so — routes to
  // the Level-Up screen (shown AFTER the point-reward modal the user just
  // confirmed). Single-flight so repeated taps never double-finalize.
  const finalizingRef = useRef(false);
  async function exitSession() {
    if (finalizingRef.current) return;
    if (answered.size === 0) {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      nav(-1);
      return;
    }
    finalizingRef.current = true;
    const duration_seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    try {
      const res = await learnApi.recordSession({
        session_type: "sentence",
        category: "conversation",
        duration_seconds,
      });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notif-unread"] });
      qc.invalidateQueries({ queryKey: ["my-learning"] });
      if (res.leveled_up && res.level_up) {
        nav("/level-up", { replace: true, state: { levelUp: res.level_up, from } });
        return;
      }
    } catch {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
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

            <FillSentence
              sentence={cur}
              keyboard={keyboard && hasBlank(cur)}
              typed={typed}
              onTyped={setTyped}
              revealed={revealed[cur.sentence_id] ?? ""}
              onSubmit={() => submitTyped(cur)}
              submitting={submitting}
              composingRef={composingRef}
            />
            {cur.translation && <div className="sess__trans">{cur.translation}</div>}

            {/* Non-blank sentences keep the romanization hint line; blanks reveal
                the hint inside the blank itself. */}
            {hintOpen && !hasBlank(cur) && cur.romanization && (
              <p className="sess__hint">💡 {cur.romanization}</p>
            )}

            <div className="sess__card-actions">
              <button
                className="sess__chip"
                onClick={() => (hasBlank(cur) ? requestHint(cur) : setHintOpen((h) => !h))}
                disabled={hintBusy || answered.has(cur.sentence_id)}
                aria-busy={hintBusy}
              >
                <span aria-hidden="true">❔</span> 힌트보기
              </button>
              <button
                className="sess__chip"
                onClick={() => setKeyboard((k) => !k)}
                aria-pressed={keyboard}
                disabled={!hasBlank(cur)}
              >
                <span aria-hidden="true">{keyboard ? "🎙" : "⌨"}</span>{" "}
                {keyboard ? "음성 모드" : "키보드 모드"}
              </button>
            </div>
          </div>

          {result ? (
            <div className="sess__result">
              <span className="sess__result-no">
                {hasBlank(cur)
                  ? "조금 더 연습해요 💪"
                  : `조금 더 연습해요 💪 · ${result.pronunciation_score}점`}
              </span>
              <button className="sess__next" onClick={next}>
                {idx >= total - 1 ? "완료" : "다음"}
              </button>
            </div>
          ) : keyboard && hasBlank(cur) ? (
            /* Keyboard mode: submit the typed answer (Enter also submits). */
            <button
              className="sess__next"
              onClick={() => submitTyped(cur)}
              disabled={submitting || !((revealed[cur.sentence_id] ?? "") + typed).trim()}
              aria-label="답 확인"
            >
              {submitting ? <span className="spinner" style={{ width: 22, height: 22 }} /> : "확인"}
            </button>
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
