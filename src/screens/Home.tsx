import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TopBar } from "../components/layout/Screen";
import { Card, ProgressRing } from "../components/ui/kit";
import { Async, SkeletonList } from "../components/ui/states";
import { dashboardApi, gameApi } from "../api/endpoints";
import { useAuth } from "../hooks/auth";
import type { DashboardSummary } from "../lib/types";

function hello() {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이에요";
  if (h < 12) return "좋은 아침이에요";
  if (h < 18) return "좋은 오후예요";
  return "좋은 저녁이에요";
}

export function Home() {
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const pts = useQuery({ queryKey: ["points"], queryFn: gameApi.points });

  return (
    <div className="screen">
      <TopBar
        title={<span className="hangul-lg" style={{ color: "var(--brand-600)" }}>한글</span>}
        right={
          <>
            <button className="topbar__btn" onClick={() => nav("/points")} title="포인트">
              <span style={{ fontSize: 14, fontWeight: 800 }}>⚡{pts.data?.season_points ?? 0}</span>
            </button>
            <button className="topbar__btn" onClick={() => nav("/notifications")} aria-label="알림">
              🔔
            </button>
          </>
        }
      />
      <div className="screen__body screen__body--nav">
        <div style={{ marginBottom: 16 }}>
          <div className="muted" style={{ fontSize: 13 }}>{hello()},</div>
          <h1 style={{ fontSize: 24 }}>{me?.nickname ?? me?.name ?? "회원"}님 👋</h1>
        </div>

        <Async
          loading={q.isLoading}
          error={q.error}
          data={q.data}
          onRetry={() => q.refetch()}
          skeleton={<SkeletonList rows={3} height={110} />}
        >
          {(d: DashboardSummary) => (
            <div className="stack" style={{ gap: 16 }}>
              {/* streak + minutes */}
              <Card variant="brand" className="row" padLg>
                <div style={{ flex: 1 }}>
                  <div style={{ opacity: 0.9, fontSize: 13, fontWeight: 700 }}>연속 학습</div>
                  <div className="big-num" style={{ fontSize: 40 }}>
                    {d.streak_days}
                    <span style={{ fontSize: 16, marginLeft: 4 }}>일 🔥</span>
                  </div>
                </div>
                <div className="center" style={{ opacity: 0.95 }}>
                  <div className="big-num" style={{ fontSize: 24 }}>{d.today_minutes}</div>
                  <div style={{ fontSize: 12 }}>오늘 학습(분)</div>
                </div>
              </Card>

              {/* premium banner */}
              {d.paywall_required && (
                <Card variant="soft" onClick={() => nav("/subscription")} className="row">
                  <span style={{ fontSize: 28 }}>👑</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800 }}>프리미엄으로 무제한 학습</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>더 높은 목표와 AI 기능을 열어보세요</div>
                  </div>
                  <span className="listrow__chev">›</span>
                </Card>
              )}

              {/* tracks with nested goal */}
              <div className="section-title">오늘의 목표</div>
              {d.tracks.map((t) => {
                const ratio = t.goal.target ? t.goal.current / t.goal.target : 0;
                return (
                  <Card
                    key={t.track_id}
                    onClick={() => nav(t.category === "topik" ? "/learn/topik" : "/learn/conversation")}
                    className="row"
                  >
                    <ProgressRing
                      value={ratio}
                      size={62}
                      stroke={7}
                      label={<span style={{ fontSize: 15, fontWeight: 900 }}>{t.category === "topik" ? "📝" : "💬"}</span>}
                    />
                    <div style={{ flex: 1 }}>
                      <div className="row row--between">
                        <span style={{ fontWeight: 800, fontSize: 16 }}>{t.name}</span>
                        <span className="badge badge--brand">Lv.{t.level}</span>
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                        {t.goal.label} {t.goal.current}/{t.goal.target}
                        {t.goal.achieved && <span style={{ color: "var(--success)", marginLeft: 6, fontWeight: 700 }}>✓ 달성!</span>}
                      </div>
                    </div>
                    <span className="listrow__chev">›</span>
                  </Card>
                );
              })}

              {/* quick actions */}
              <div className="section-title">바로가기</div>
              <div className="grid-2">
                <Card onClick={() => nav("/ai")} className="stack" style={{ gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 26 }}>🤖</span>
                  <div style={{ fontWeight: 800 }}>AI 튜터</div>
                  <div className="muted" style={{ fontSize: 12 }}>대화하며 배우기</div>
                </Card>
                <Card onClick={() => nav("/saved")} className="stack" style={{ gap: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 26 }}>🔖</span>
                  <div style={{ fontWeight: 800 }}>저장 · 복습</div>
                  <div className="muted" style={{ fontSize: 12 }}>틀린 문제 다시보기</div>
                </Card>
              </div>
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
