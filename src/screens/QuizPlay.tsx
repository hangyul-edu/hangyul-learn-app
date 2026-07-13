import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { Async } from "../components/ui/states";
import { QuestionView, isAnswered, quizAttemptBody } from "../components/QuestionView";
import type { AnswerValue } from "../components/QuestionView";
import { quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type { Quiz, QuizAttemptResult } from "../lib/types";

export function QuizPlay() {
  const { quizId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [value, setValue] = useState<AnswerValue>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const q = useQuery({ queryKey: ["quiz", quizId], queryFn: () => quizApi.get(quizId) });

  async function submit(quiz: Quiz) {
    setBusy(true);
    try {
      setResult(await quizApi.attempt(quizId, quizAttemptBody(quiz, value)));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="문제 풀기" back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()}>
        {(quiz: Quiz) => (
          <div className="stack" style={{ gap: 16 }}>
            <QuestionView quiz={quiz} value={value} onChange={setValue} disabled={!!result} />
            {!result ? (
              <Button size="lg" block loading={busy} disabled={!isAnswered(quiz, value)} onClick={() => submit(quiz)}>
                제출하기
              </Button>
            ) : (
              <div className="card" style={{ borderColor: result.correct ? "var(--success)" : "var(--danger)", background: result.correct ? "var(--success-bg)" : "var(--danger-bg)" }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: result.correct ? "var(--success)" : "var(--danger)" }}>
                  {result.correct ? "정답이에요! 🎉" : result.status === "submitted" ? "제출 완료 ✍️" : "아쉬워요 😢"}
                </div>
                {result.correct_answer && <div style={{ marginTop: 8, fontSize: 14 }}>정답: <b>{result.correct_answer}</b></div>}
                {result.explanation && <div className="muted" style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55 }}>{result.explanation}</div>}
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  {!!result.xp_awarded && <span className="badge badge--brand">+{result.xp_awarded} XP</span>}
                  {!!result.points_earned && <span className="badge badge--brand">⚡ +{result.points_earned}</span>}
                  {typeof result.score === "number" && <span className="badge">채점 {result.score}점</span>}
                </div>
                <div style={{ height: 12 }} />
                <Button block variant="secondary" onClick={() => nav(-1)}>목록으로</Button>
              </div>
            )}
          </div>
        )}
      </Async>
    </Screen>
  );
}
