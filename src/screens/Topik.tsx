import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Card, Chip } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { quizApi } from "../api/endpoints";
import { TOPIK_GRADES } from "../lib/levels";
import type { Quiz } from "../lib/types";

const SECTION_LABEL_KEYS: Record<string, TranslationKey> = {
  listening: "study.skillListening",
  reading: "study.skillReading",
  writing: "study.skillWriting",
};
const FORMAT_LABEL_KEYS: Record<string, TranslationKey> = {
  single_choice: "study.typeMultiple",
  short_answer: "study.typeShort",
  free_response: "study.typeEssay",
};

function QuizRow({ q, onClick }: { q: Quiz; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button className="listrow" onClick={onClick}>
      <div className="avatar" style={{ width: 40, height: 40, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 18 }}>
        {q.topik_section === "listening" ? "🎧" : q.topik_section === "writing" ? "✍️" : "📖"}
      </div>
      <div className="listrow__main">
        <div className="listrow__title">{q.prompt || t("study.topikQuestions")}</div>
        <div className="listrow__sub">
          {q.topik_section
            ? SECTION_LABEL_KEYS[q.topik_section]
              ? t(SECTION_LABEL_KEYS[q.topik_section])
              : q.topik_section
            : ""}{" · "}
          {FORMAT_LABEL_KEYS[q.answer.format] ? t(FORMAT_LABEL_KEYS[q.answer.format]) : q.answer.format}
          {q.level ? ` · Lv.${q.level}` : ""}
        </div>
      </div>
      <span className="listrow__chev">›</span>
    </button>
  );
}

export function Topik() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [level, setLevel] = useState<number | undefined>(undefined);

  const daily = useQuery({ queryKey: ["quiz-daily"], queryFn: quizApi.daily });
  const list = useQuery({ queryKey: ["quiz-list", level], queryFn: () => quizApi.list({ level, limit: 20 }) });

  return (
    <Screen title={t("study.topikTitle")} back>
      <div className="stack" style={{ gap: 18 }}>
        <Card variant="soft">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>{t("study.todayQuestion")}</div>
            <span className="badge badge--brand">{t("study.dailyRefresh")}</span>
          </div>
          {daily.isLoading ? (
            <SkeletonList rows={2} height={44} />
          ) : daily.data?.questions.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {daily.data.questions.slice(0, 5).map((q) => (
                <QuizRow key={q.quiz_id} q={q} onClick={() => nav(`/quiz/${q.quiz_id}`)} />
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, padding: "8px 2px" }}>{t("study.todayError")}</div>
          )}
        </Card>

        <div>
          <div className="section-title">{t("study.questionBank")}</div>
          <div className="chiprow" style={{ marginBottom: 12 }}>
            <Chip active={level === undefined} onClick={() => setLevel(undefined)}>{t("study.all")}</Chip>
            {TOPIK_GRADES.map((l) => (
              <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
                {t("study.gradeSuffix", { n: l })}
              </Chip>
            ))}
          </div>
          <Async
            loading={list.isLoading}
            error={list.error}
            data={list.data}
            onRetry={() => list.refetch()}
            isEmpty={(d) => (d.items?.length ?? 0) === 0}
            empty={<EmptyState emoji="📝" title={t("study.noQuestions")} text={t("study.tryAnotherGrade")} />}
            skeleton={<SkeletonList rows={5} height={64} />}
          >
            {(d) => (
              <div className="stack" style={{ gap: 8 }}>
                {d.items.map((q) => (
                  <QuizRow key={q.quiz_id} q={q} onClick={() => nav(`/quiz/${q.quiz_id}`)} />
                ))}
              </div>
            )}
          </Async>
        </div>
      </div>
    </Screen>
  );
}
