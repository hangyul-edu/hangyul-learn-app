import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Badge, Button, Card } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { QuestionView, examAnswerString, isAnswered } from "../components/QuestionView";
import type { AnswerValue } from "../components/QuestionView";
import { examApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { ApiError, errorMessage } from "../lib/http";
import type { ExamResult, ExamSet } from "../lib/types";

const SECTION_KEYS: Record<string, TranslationKey> = {
  listening: "study.skillListening",
  reading: "study.skillReading",
};

export function Exams() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["exams"], queryFn: () => examApi.list() });
  return (
    <Screen title={t("study.examTitle")} back>
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} isEmpty={(d) => d.items.length === 0} empty={<EmptyState emoji="🎓" title={t("study.examNone")} />} skeleton={<SkeletonList rows={5} height={72} />}>
        {(d) => (
          <div className="stack" style={{ gap: 10 }}>
            {d.items.map((e: ExamSet) => (
              <Card key={e.exam_set_id} onClick={() => nav(`/exams/${e.exam_set_id}`)}>
                <div className="row">
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--brand-100)", display: "grid", placeItems: "center", fontSize: 22 }}>
                    {e.section === "listening" ? "🎧" : "📖"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{e.title}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                      {t("study.examMeta", {
                        year: e.year,
                        section: t(SECTION_KEYS[e.section]),
                        count: e.question_count,
                        band: e.level_band,
                      })}
                    </div>
                  </div>
                  {e.access === "premium" ? <Badge tone="premium">👑</Badge> : <Badge tone="success">{t("study.examFree")}</Badge>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Async>
    </Screen>
  );
}

export function ExamPlay() {
  const { t } = useTranslation();
  const { examId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [locked, setLocked] = useState(false);

  const q = useQuery({
    queryKey: ["exam", examId],
    queryFn: () => examApi.get(examId),
    retry: false,
  });
  // The exam question on screen counts as study (streak + learning day + the
  // sun), recorded once per UTC day and silently. Nothing is shown — so nothing
  // recorded — while loading, when locked, or on the graded result.
  useRecordDisplayedItem("topik", result ? null : q.data?.questions?.[idx]?.quiz_id);

  if (q.error instanceof ApiError && q.error.status === 402 && !locked) setLocked(true);
  if (locked)
    return (
      <Screen title={t("study.examMock")} back>
        <EmptyState emoji="👑" title={t("study.examPremium")} text={t("study.examDesc")} action={<Button onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>} />
      </Screen>
    );

  async function submit(qs: ExamSet) {
    setBusy(true);
    try {
      const payload = (qs.questions ?? []).map((quiz) => ({
        quiz_id: quiz.quiz_id,
        answer: examAnswerString(quiz, answers[quiz.quiz_id] ?? {}),
      }));
      setResult(await examApi.submit(examId, payload));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={t("study.examMock")} back>
      <Async loading={q.isLoading} error={locked ? null : q.error} data={q.data} onRetry={() => q.refetch()}>
        {(exam: ExamSet) => {
          const questions = exam.questions ?? [];
          if (result) {
            const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
            return (
              <div className="state">
                <div className="state__emoji">{pct >= 60 ? "🎉" : "💪"}</div>
                <div className="state__title">{t("study.examGraded")}</div>
                <div className="big-num" style={{ fontSize: 44, color: "var(--brand-600)" }}>{result.score} / {result.total}</div>
                <div className="muted">{t("study.correctPct", { pct })}</div>
                <Button style={{ marginTop: 12 }} onClick={() => nav(-1)}>{t("study.backToList")}</Button>
              </div>
            );
          }
          const quiz = questions[idx];
          if (!quiz) return <EmptyState title={t("study.examNoItems")} />;
          const last = idx === questions.length - 1;
          return (
            <div className="stack" style={{ gap: 16 }}>
              <div className="row row--between">
                <span className="muted" style={{ fontSize: 13 }}>{idx + 1} / {questions.length}</span>
                <span className="badge">{exam.title}</span>
              </div>
              <QuestionView quiz={quiz} value={answers[quiz.quiz_id] ?? {}} onChange={(v) => setAnswers((a) => ({ ...a, [quiz.quiz_id]: v }))} />
              <div className="row" style={{ gap: 10 }}>
                <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>{t("study.prev")}</Button>
                {last ? (
                  <Button block loading={busy} onClick={() => submit(exam)}>{t("study.examSubmit")}</Button>
                ) : (
                  <Button block disabled={!isAnswered(quiz, answers[quiz.quiz_id] ?? {})} onClick={() => setIdx((i) => i + 1)}>{t("study.next")}</Button>
                )}
              </div>
            </div>
          );
        }}
      </Async>
    </Screen>
  );
}
