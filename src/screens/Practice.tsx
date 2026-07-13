import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Screen } from "../components/layout/Screen";
import { Button, Card, OptionCard } from "../components/ui/kit";
import { EmptyState, LoadingState } from "../components/ui/states";
import { QuestionView, isAnswered, quizAttemptBody } from "../components/QuestionView";
import type { AnswerValue } from "../components/QuestionView";
import { practiceApi, quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { ApiError, errorMessage } from "../lib/http";
import type { Quiz, QuizAttemptResult } from "../lib/types";

export function Practice() {
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Quiz[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);

  async function start(count: number) {
    setStarting(true);
    try {
      const res = await practiceApi.start(lectureId, count);
      setItems(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setLocked(true);
      else toast.error(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  async function submit(quiz: Quiz) {
    setBusy(true);
    try {
      const r = await quizApi.attempt(quiz.quiz_id, quizAttemptBody(quiz, value));
      setResult(r);
      if (r.correct) setCorrect((c) => c + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    setResult(null);
    setValue({});
    setIdx((i) => i + 1);
  }

  if (locked)
    return (
      <Screen title="복습 문제" back>
        <EmptyState emoji="👑" title="프리미엄 전용 기능이에요" text="복습 문제로 실력을 더 다져보세요." action={<Button onClick={() => nav("/subscription")}>업그레이드</Button>} />
      </Screen>
    );

  if (!items)
    return (
      <Screen title="복습 문제" back>
        {starting ? (
          <LoadingState text="문제를 준비하고 있어요…" />
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <h2 style={{ fontSize: 21 }}>몇 문제를 풀어볼까요?</h2>
            <div className="grid-2">
              {[5, 10, 15, 20].map((n) => (
                <OptionCard key={n} selected={false} onClick={() => start(n)} title={`${n}문제`} />
              ))}
            </div>
          </div>
        )}
      </Screen>
    );

  if (idx >= items.length)
    return (
      <Screen title="복습 완료" back>
        <div className="state">
          <div className="state__emoji">🎉</div>
          <div className="state__title">복습 완료!</div>
          <div className="big-num" style={{ fontSize: 40, color: "var(--brand-600)" }}>{correct} / {items.length}</div>
          <div className="muted">정답</div>
          <Button style={{ marginTop: 10 }} onClick={() => nav(-1)}>돌아가기</Button>
        </div>
      </Screen>
    );

  const quiz = items[idx];
  return (
    <Screen title={`복습 ${idx + 1}/${items.length}`} back>
      <div className="stack" style={{ gap: 16 }}>
        <div className="progress" style={{ height: 6 }}>
          <div className="progress__bar" style={{ width: `${(idx / items.length) * 100}%` }} />
        </div>
        <QuestionView quiz={quiz} value={value} onChange={setValue} disabled={!!result} />
        {!result ? (
          <Button size="lg" block loading={busy} disabled={!isAnswered(quiz, value)} onClick={() => submit(quiz)}>
            제출
          </Button>
        ) : (
          <Card style={{ borderColor: result.correct ? "var(--success)" : "var(--danger)", background: result.correct ? "var(--success-bg)" : "var(--danger-bg)" }}>
            <div style={{ fontWeight: 800, color: result.correct ? "var(--success)" : "var(--danger)" }}>
              {result.correct ? "정답! 🎉" : "아쉬워요 😢"}
            </div>
            {result.explanation && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{result.explanation}</div>}
            <div style={{ height: 10 }} />
            <Button block onClick={next}>{idx + 1 < items.length ? "다음 문제 →" : "결과 보기"}</Button>
          </Card>
        )}
      </div>
    </Screen>
  );
}
