import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SessionChrome } from "../components/SessionChrome";
import { SessionCompleteModal } from "../components/SessionCompleteModal";
import { QuestionView, isAnswered, quizAttemptBody, type AnswerValue } from "../components/QuestionView";
import { SavePlusIcon } from "../components/brand/HomeIcons";
import { LoadingState, ErrorState } from "../components/ui/states";
import { recApi, quizApi, dashboardApi, learnApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { Quiz, QuizAttemptResult, TopikSection } from "../lib/types";

export function SessionTopik() {
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const navState = loc.state as { from?: string; section?: TopikSection } | null;
  // Source page (Home / Personalized), forwarded to the Level-Up screen so its
  // button returns the user there.
  const from = navState?.from ?? "/home";
  // The TOPIK part chosen in the part-selection modal drives the question-type
  // dropdown and generation; it's fixed for the whole session. Fall back to
  // listening only if the screen is reached without a selection (deep link).
  const section: TopikSection = navState?.section ?? "listening";
  const qc = useQueryClient();

  const dash = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const topik = dash.data?.tracks.find((t) => t.category === "topik");
  const grade = topik?.level ?? 1;
  const remaining = topik ? Math.max(topik.goal.target - topik.goal.current, 0) : 0;

  const types = useQuery({
    queryKey: ["topik-question-types", section],
    queryFn: () => recApi.topikQuestionTypes(section),
  });

  const [open, setOpen] = useState(false);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [items, setItems] = useState<Quiz[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [correctSet, setCorrectSet] = useState<Set<string>>(new Set());
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [points, setPoints] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  async function loadSet(code?: string | null) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const count = Math.max(remaining || 0, 1);
      const res = await recApi.questions({ section, count, ...(code ? { topik_question_type: code } : {}) });
      setItems(res.items);
      setIdx(0);
      setValue({});
      setResult(null);
      setCorrectSet(new Set());
      setAnswered(new Set());
    } catch (e) {
      if (items === null) setError(true);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const startedAt = useRef(Date.now());
  // Fetch the initial set once the dashboard (remaining goal) has resolved.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current || !dash.data) return;
    booted.current = true;
    void loadSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash.data]);

  const total = items?.length ?? 0;
  const cur = items?.[idx];
  const progress = total ? answered.size / total : 0;
  // Note: opening/viewing a question does NOT count as learning. Today is only
  // credited as a learning day once the user answers a question correctly —
  // that happens server-side on the correct attempt, and the sun refreshes when
  // the dashboard query is invalidated on session exit.

  async function submit() {
    if (!cur || submitting || result || !isAnswered(cur, value)) return;
    setSubmitting(true);
    try {
      const res = await quizApi.attempt(cur.quiz_id, quizAttemptBody(cur, value));
      setResult(res);
      setAnswered((a) => new Set(a).add(cur.quiz_id));
      setPoints((p) => p + (res.points_earned ?? 0));
      if (res.correct) setCorrectSet((c) => new Set(c).add(cur.quiz_id));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setResult(null);
    setValue({});
    if (idx >= total - 1) {
      finishOrExit();
    } else {
      setIdx((i) => i + 1);
    }
  }

  // Same gate for the CTA at completion and the back chevron.
  function finishOrExit() {
    if (correctSet.size > 0) setCompleted(true);
    else exitSession();
  }

  // Single exit path for 완료 (modal) and the back chevron. Finalizes the
  // personalized session on the server; a level-up routes to the Level-Up screen
  // (after the point-reward modal). Single-flight so repeated taps can't
  // double-finalize.
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
        category: "topik",
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

  async function toggleSave(q: Quiz) {
    const on = saved[q.quiz_id];
    setSaved((m) => ({ ...m, [q.quiz_id]: !on }));
    try {
      if (on) await quizApi.unbookmark(q.quiz_id);
      else await quizApi.bookmark(q.quiz_id);
    } catch (e) {
      setSaved((m) => ({ ...m, [q.quiz_id]: on }));
      toast.error(errorMessage(e));
    }
  }

  const incorrect = !!result && !result.correct;

  const panel = (
    <div className="sess__dropdown">
      <button className="sess__dropdown-field" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox">
        <span className={typeCode ? "sess__dropdown-val" : "sess__dropdown-ph"}>
          {typeCode
            ? (() => {
                const t = types.data?.items.find((x) => x.code === typeCode);
                return t ? `[유형${t.number_label}] ${t.title_ko}` : "선택됨";
              })()
            : "✨ 더 집중해서 풀어보고 싶은 문제 유형을 선택해보세요"}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} stroke="#8a929a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="sess__dropdown-list" role="listbox" aria-label="TOPIK 문제 유형">
          {(types.data?.items ?? []).map((t) => (
            <li key={t.code} role="option" aria-selected={typeCode === t.code}>
              <button
                className={`sess__dropdown-item ${typeCode === t.code ? "is-selected" : ""}`}
                onClick={() => {
                  setTypeCode(t.code);
                  setOpen(false);
                  void loadSet(t.code);
                }}
              >
                [유형{t.number_label}] {t.title_ko}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
    <SessionChrome
      title={`토픽 ${grade}급`}
      heading="목표 하루 학습 문제"
      correct={correctSet.size}
      total={total}
      progress={progress}
      panel={panel}
      onBack={finishOrExit}
      askContext={
        !cur
          ? null
          : incorrect && result
            ? { contextKind: "quiz_attempt", contextId: result.attempt_id, autoExplain: true, bubble: true }
            : { contextKind: "quiz", contextId: cur.quiz_id, autoExplain: false, bubble: false }
      }
    >
      {error ? (
        <ErrorState message="문제를 불러오지 못했어요." onRetry={() => loadSet(typeCode)} />
      ) : !cur ? (
        <LoadingState />
      ) : (
        <div className="sess__card">
          <div className="sess__card-top">
            <p className="sess__instr sess__instr--topik">문제를 풀어보세요</p>
            <button className="sess__bookmark" onClick={() => toggleSave(cur)} aria-label={saved[cur.quiz_id] ? "저장 해제" : "저장"} aria-pressed={!!saved[cur.quiz_id]}>
              <SavePlusIcon active={!!saved[cur.quiz_id]} />
            </button>
          </div>

          <QuestionView quiz={cur} value={value} onChange={setValue} disabled={!!result} />

          {result ? (
            <div className="sess__result">
              <span className={result.correct ? "sess__result-ok" : "sess__result-no"}>
                {result.correct ? "정답이에요! 🎉" : "아쉬워요 💪"}
                {!result.correct && result.correct_answer ? ` · 정답: ${result.correct_answer}` : ""}
              </span>
              {result.explanation && <p className="sess__explain">{result.explanation}</p>}
              <button className="sess__next" onClick={next}>
                {idx >= total - 1 ? "완료" : "다음"}
              </button>
            </div>
          ) : (
            <button className="sess__submit" onClick={submit} disabled={!isAnswered(cur, value) || submitting}>
              {submitting ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2.5 }} /> : "제출"}
            </button>
          )}
        </div>
      )}
    </SessionChrome>
    {completed && (
      <SessionCompleteModal mode="topik" correctCount={correctSet.size} points={points} onConfirm={exitSession} />
    )}
    </>
  );
}
