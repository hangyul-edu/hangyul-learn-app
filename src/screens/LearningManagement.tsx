import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { dashboardApi } from "../api/endpoints";
import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";
import { Async } from "../components/ui/states";
import { Button } from "../components/ui/kit";
import type { DashboardSummary } from "../lib/types";

/** Minutes → "HH:MM" for the "오늘 공부한 시간" value. */
function fmtHHMM(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "오늘의 학습" — today's completed learning items across tracks (each track's
 *  today goal progress). Zero for a brand-new user. */
function todayLearningCount(d: DashboardSummary | undefined): number {
  return d ? d.tracks.reduce((n, t) => n + (t.goal?.current ?? 0), 0) : 0;
}

/**
 * Learning Management (학습 관리) page. Shows today's learning summary (real data)
 * and the user's learning-history section. A user with no learning days yet
 * (`streak.total_days === 0`) sees the empty state with a CTA into personalized
 * learning; the summary card renders normally regardless.
 */
export function LearningManagement() {
  const nav = useNavigate();
  const navigatingRef = useRef(false);

  // Today's summary card (study time + today's learning count).
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  // "내 학습 기록" emptiness — the count of distinct learning days ever (the same
  // signal the Streak/Profile pages use). This is the "learning-history request".
  const history = useQuery({ queryKey: ["streak"], queryFn: dashboardApi.streak });

  const studyTime = fmtHHMM(summary.data?.today_minutes ?? 0);
  const learnCount = todayLearningCount(summary.data);

  function startLearning() {
    if (navigatingRef.current) return; // guard rapid double taps → one navigation
    navigatingRef.current = true;
    nav("/recommend");
  }

  return (
    <div className="screen lmgmt">
      <div className="lmgmt__scroll">
        <header className="strk__header lmgmt__header">
          <button className="strk__back" onClick={() => nav("/home")} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <LearningSectionSwitcher current="management" />
        </header>

        <h1 className="lmgmt__heading">첫 학습을 기다리고 있어요!</h1>

        {/* Today's learning summary — real data, 00:00 / 0 only as a true-zero fallback. */}
        <div className="lmgmt__summary">
          <div className="lmgmt__summary-col">
            <span className="lmgmt__summary-label">오늘 공부한 시간</span>
            <span className="lmgmt__summary-value">{studyTime}</span>
          </div>
          <div className="lmgmt__summary-divider" aria-hidden="true" />
          <div className="lmgmt__summary-col">
            <span className="lmgmt__summary-label">오늘의 학습</span>
            <span className="lmgmt__summary-value">{learnCount}</span>
          </div>
        </div>

        <div className="lmgmt__band" aria-hidden="true" />

        <h2 className="lmgmt__section-title">내 학습 기록</h2>

        <div className="lmgmt__history">
          <Async
            loading={history.isLoading}
            error={history.error}
            data={history.data}
            onRetry={() => history.refetch()}
            isEmpty={(d) => (d.total_days ?? 0) === 0}
            empty={
              <div className="lmgmt__empty">
                <p className="lmgmt__empty-title">학습 기록이 아직 없어요</p>
                <p className="lmgmt__empty-desc">
                  첫 학습을 시작하고
                  <br />
                  당신의 기록을 만들어 보세요!
                </p>
                <Button
                  variant="primary"
                  className="lmgmt__cta"
                  onClick={startLearning}
                  aria-label="학습 시작하기, 맞춤 학습으로 이동"
                >
                  학습 시작하기
                </Button>
              </div>
            }
          >
            {(d) => <p className="lmgmt__history-summary">지금까지 총 {d.total_days}일 학습했어요.</p>}
          </Async>
        </div>
      </div>
    </div>
  );
}
