import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Card, Chip } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { quizApi } from "../api/endpoints";
import { TOPIK_GRADES } from "../lib/levels";
import type { Quiz } from "../lib/types";

const SECTION_LABEL: Record<string, string> = { listening: "듣기", reading: "읽기", writing: "쓰기" };
const FORMAT_LABEL: Record<string, string> = { single_choice: "객관식", short_answer: "단답형", free_response: "서술형" };

function QuizRow({ q, onClick }: { q: Quiz; onClick: () => void }) {
  return (
    <button className="listrow" onClick={onClick}>
      <div className="avatar" style={{ width: 40, height: 40, background: "var(--brand-100)", color: "var(--brand-700)", fontSize: 18 }}>
        {q.topik_section === "listening" ? "🎧" : q.topik_section === "writing" ? "✍️" : "📖"}
      </div>
      <div className="listrow__main">
        <div className="listrow__title">{q.prompt || "TOPIK 문제"}</div>
        <div className="listrow__sub">
          {q.topik_section ? SECTION_LABEL[q.topik_section] ?? q.topik_section : ""} · {FORMAT_LABEL[q.answer.format]}
          {q.level ? ` · Lv.${q.level}` : ""}
        </div>
      </div>
      <span className="listrow__chev">›</span>
    </button>
  );
}

export function Topik() {
  const nav = useNavigate();
  const [level, setLevel] = useState<number | undefined>(undefined);

  const daily = useQuery({ queryKey: ["quiz-daily"], queryFn: quizApi.daily });
  const list = useQuery({ queryKey: ["quiz-list", level], queryFn: () => quizApi.list({ level, limit: 20 }) });

  return (
    <Screen title="TOPIK 학습" back>
      <div className="stack" style={{ gap: 18 }}>
        <Card variant="soft">
          <div className="row row--between" style={{ marginBottom: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>📅 오늘의 문제</div>
            <span className="badge badge--brand">매일 갱신</span>
          </div>
          {daily.isLoading ? (
            <SkeletonList rows={2} height={44} />
          ) : daily.data?.items?.length ? (
            <div className="stack" style={{ gap: 8 }}>
              {daily.data.items.slice(0, 5).map((q) => (
                <QuizRow key={q.quiz_id} q={q} onClick={() => nav(`/quiz/${q.quiz_id}`)} />
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, padding: "8px 2px" }}>오늘의 문제를 불러오지 못했어요.</div>
          )}
        </Card>

        <div>
          <div className="section-title">문제 은행</div>
          <div className="chiprow" style={{ marginBottom: 12 }}>
            <Chip active={level === undefined} onClick={() => setLevel(undefined)}>전체</Chip>
            {TOPIK_GRADES.map((l) => (
              <Chip key={l} active={level === l} onClick={() => setLevel(l)}>
                {l}급
              </Chip>
            ))}
          </div>
          <Async
            loading={list.isLoading}
            error={list.error}
            data={list.data}
            onRetry={() => list.refetch()}
            isEmpty={(d) => (d.items?.length ?? 0) === 0}
            empty={<EmptyState emoji="📝" title="문제가 없어요" text="다른 급수를 선택해 보세요." />}
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
