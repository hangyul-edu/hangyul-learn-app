import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Card } from "../components/ui/kit";
import { Async, EmptyState, SkeletonList } from "../components/ui/states";
import { gameApi } from "../api/endpoints";
import { timeAgo } from "../lib/format";

const REASON_LABEL: Record<string, string> = {
  sentence_complete: "회화 문장 학습",
  quiz_complete: "TOPIK 문제 정답",
  lecture_complete: "강의 완료",
  saved_sentence_review: "복습 완료",
  attendance: "출석 체크",
  attendance_streak_bonus: "출석 연속 보너스",
  level_up_bonus: "레벨업 보너스",
};

export function Points() {
  const bal = useQuery({ queryKey: ["points"], queryFn: gameApi.points });
  const hist = useQuery({ queryKey: ["points-history"], queryFn: () => gameApi.pointsHistory() });

  return (
    <Screen title="포인트" back>
      <Card variant="brand" padLg style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ opacity: 0.9, fontSize: 13, fontWeight: 700 }}>이번 주 포인트</div>
        <div className="big-num" style={{ fontSize: 46 }}>⚡ {bal.data?.season_points ?? 0}</div>
        <div style={{ opacity: 0.85, fontSize: 12 }}>매주 월요일 리셋 · 리그 순위에 반영돼요</div>
      </Card>

      <div className="section-title">적립 내역</div>
      <Async
        loading={hist.isLoading}
        error={hist.error}
        data={hist.data}
        onRetry={() => hist.refetch()}
        isEmpty={(d) => d.items.length === 0}
        empty={<EmptyState emoji="⚡" title="아직 적립 내역이 없어요" text="학습하면 포인트가 쌓여요!" />}
        skeleton={<SkeletonList rows={6} height={54} />}
      >
        {(d) => (
          <div className="stack" style={{ gap: 8 }}>
            {d.items.map((it, i) => (
              <div key={i} className="listrow" style={{ cursor: "default" }}>
                <div className="listrow__main">
                  <div className="listrow__title">{REASON_LABEL[it.reason] ?? it.reason}</div>
                  <div className="listrow__sub">{timeAgo(it.occurred_at)}</div>
                </div>
                <div className="big-num" style={{ fontSize: 16, color: "var(--brand-600)" }}>+{it.amount}</div>
              </div>
            ))}
          </div>
        )}
      </Async>
    </Screen>
  );
}
