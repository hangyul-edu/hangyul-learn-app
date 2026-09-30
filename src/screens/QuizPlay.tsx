import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { Async } from "../components/ui/states";
import { QuestionView, isAnswered, quizAttemptBody } from "../components/QuestionView";
import type { AnswerValue } from "../components/QuestionView";
import { quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { errorMessage } from "../lib/http";
import type { Quiz, QuizAttemptResult } from "../lib/types";

export function QuizPlay() {
  const { t } = useTranslation();
  const { quizId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [value, setValue] = useState<AnswerValue>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const q = useQuery({ queryKey: ["quiz", quizId], queryFn: () => quizApi.get(quizId) });
  // The question on screen counts as study (streak + learning day + the sun),
  // recorded once per local day and silently.
  useRecordDisplayedItem("topik", q.data?.quiz_id);

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
    <Screen title={t("study.quizTitle")} back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()}>
        {(quiz: Quiz) => (
          <div className="stack" style={{ gap: 16 }}>
            <QuestionView quiz={quiz} value={value} onChange={setValue} disabled={!!result} />
            {!result ? (
              <Button size="lg" block loading={busy} disabled={!isAnswered(quiz, value)} onClick={() => submit(quiz)}>
                {t("study.submit")}
              </Button>
            ) : (
              // Writing is scored, never right/wrong (`correct` is null): it gets
              // the neutral "submitted" verdict plus its score, not "wrong".
              <div className="card" style={{ borderColor: result.correct === false ? "var(--danger)" : "var(--success)", background: result.correct === false ? "var(--danger-bg)" : "var(--success-bg)" }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: result.correct === false ? "var(--danger)" : "var(--success)" }}>
                  {t(result.correct ? "study.quizCorrect" : result.correct === false ? "study.quizWrong" : "study.quizSubmitted")}
                </div>
                {result.correct_answer && <div style={{ marginTop: 8, fontSize: 14 }}>{t("study.answerPrefix")} <b>{result.correct_answer}</b></div>}
                {result.explanation && <div className="muted" style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55 }}>{result.explanation}</div>}
                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                  {!!result.xp_earned && <span className="badge badge--brand">+{result.xp_earned} XP</span>}
                  {!!result.points_earned && <span className="badge badge--brand">⚡ +{result.points_earned}</span>}
                  {result.writing && <span className="badge">{t("study.scoreBadge", { score: result.writing.score })}</span>}
                </div>
                <div style={{ height: 12 }} />
                <Button block variant="secondary" onClick={() => nav(-1)}>{t("study.backToList")}</Button>
              </div>
            )}
          </div>
        )}
      </Async>
    </Screen>
  );
}
