import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { dashboardApi } from "../api/endpoints";
import { CharacterArt } from "../components/brand/ProfileAssets";
import { SunIcon, SpeakingIcon, PencilIcon, GearIcon, BookIcon, ChevronRight } from "../components/brand/HomeIcons";
import type { DashboardSummary, DashboardTrack } from "../lib/types";

/** Open horseshoe gauge with the percentage centered (yellow when complete). */
function Gauge({ ratio, done }: { ratio: number; done: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const arcColor = done ? "#FFB91F" : "#FF5B00";
  const r = 78;
  const start = 135;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const filled = (pct / 100) * arcLen;
  const pol = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${100 + r * Math.cos(a)} ${100 + r * Math.sin(a)}`;
  };
  const d = `M ${pol(start)} A ${r} ${r} 0 1 1 ${pol(start + sweep)}`;
  return (
    <div className="home__gauge">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path d={d} fill="none" stroke="#F7EFE3" strokeWidth="20" strokeLinecap="round" />
        {pct > 0 && (
          <path d={d} fill="none" stroke={arcColor} strokeWidth="20" strokeLinecap="round" strokeDasharray={`${filled} ${arcLen}`} />
        )}
      </svg>
      <div className="home__gauge-val">
        <span className="home__gauge-num">{pct}</span>
        <span className="home__gauge-pct">%</span>
      </div>
    </div>
  );
}

function RepeatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 8a7 7 0 0 1 12-3M20 16a7 7 0 0 1-12 3" stroke="#7B8799" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 3v3h-3M8 21v-3h3" stroke="#7B8799" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4l2.3 4.7 5.2.8-3.8 3.6.9 5.1L12 15.9 7.4 18.3l.9-5.1L4.5 9.5l5.2-.8L12 4z" stroke="#7B8799" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function trackIcon(category: string) {
  return category === "topik" ? <PencilIcon size={30} /> : <SpeakingIcon size={30} />;
}

export function Personalized() {
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const [tab, setTab] = useState(0);

  return (
    <div className="screen plearn">
      <div className="screen__body screen__body--nav plearn__body">
        <Async
          loading={q.isLoading}
          error={q.error}
          data={q.data}
          onRetry={() => q.refetch()}
          skeleton={<SkeletonList rows={3} height={130} />}
        >
          {(d: DashboardSummary) => {
            const tracks = d.tracks;
            const active: DashboardTrack | undefined = tracks[Math.min(tab, tracks.length - 1)];
            const target = active?.goal.target ?? 0;
            const cur = active?.goal.current ?? 0;
            const done = !!active && target > 0 && (active.goal.achieved || cur >= target);
            const shown = target > 0 ? Math.min(cur, target) : cur;
            const ratio = target ? cur / target : 0;

            return (
              <>
                <header className="plearn__header">
                  <h1 className="plearn__title">맞춤 학습</h1>
                  <button className="plearn__streak" onClick={() => nav("/streak")} aria-label={`연속 학습 ${d.streak_days}일, 달력 열기`}>
                    <SunIcon size={22} />
                    <span>{d.streak_days}</span>
                  </button>
                </header>

                {tracks.length > 0 && active && (
                  <>
                    {/* Mode tabs (data-driven) */}
                    <div className="home__tabs" role="tablist" aria-label="학습 모드">
                      {tracks.map((t, i) => (
                        <button
                          key={t.track_id}
                          role="tab"
                          aria-selected={i === tab}
                          aria-label={t.name}
                          className={`home__tab ${i === tab ? "is-active" : ""} home__tab--${t.category}`}
                          onClick={() => setTab(i)}
                        >
                          {trackIcon(t.category)}
                        </button>
                      ))}
                      <span className="home__tab home__tab--muted" aria-hidden="true">
                        <GearIcon />
                      </span>
                    </div>

                    {/* Learning card */}
                    <section className={`home__hero ${done ? "is-done" : ""}`} aria-label={`${active.name} 학습 현황`}>
                      {done && (
                        <div className="home__hero-banner" role="status">
                          오늘 목표 100% 달성! 대단해요 ✨
                        </div>
                      )}
                      <div className="home__hero-top">
                        <div className="home__hero-info">
                          <h2 className="home__hero-title">{active.name}</h2>
                          <div className="home__hero-level">
                            {active.category === "topik" ? `${active.level}급` : `Lv.${active.level}`}
                          </div>
                          <div
                            className="home__hero-goal"
                            aria-label={`${active.goal.label || "하루 목표"} ${target}개 중 ${shown}개 완료, ${Math.min(100, Math.round(ratio * 100))}퍼센트`}
                          >
                            <span className="home__hero-goal-label">{active.goal.label || "하루 목표"}</span>
                            <span className="home__hero-goal-frac">{shown}/{target}</span>
                          </div>
                        </div>
                        <Gauge ratio={ratio} done={done} />
                      </div>
                      <button
                        className="home__hero-cta"
                        onClick={() => nav(active.category === "topik" ? "/session/topik" : "/session/conversation")}
                      >
                        {cur > 0 ? "이어서 학습하기" : "바로 시작하기"}
                      </button>
                    </section>
                  </>
                )}

                {/* Review card */}
                <section className="plearn__review">
                  <BookIcon size={70} />
                  <span className="plearn__review-title">복습하기</span>
                  <div className="plearn__review-actions">
                    <button
                      className="plearn__review-pill"
                      onClick={() => nav("/saved", { state: { tab: "sentence", filter: "auto_wrong" } })}
                      aria-label="오답 다시 풀기"
                    >
                      <RepeatIcon />
                      <ChevronRight size={18} color="#7B8799" />
                    </button>
                    <button
                      className="plearn__review-pill"
                      onClick={() => nav("/saved", { state: { tab: "sentence", filter: "favorite" } })}
                      aria-label="즐겨찾기 복습"
                    >
                      <StarIcon />
                      <ChevronRight size={18} color="#7B8799" />
                    </button>
                  </div>
                </section>

                {/* Decorative mascot scene */}
                <div className="plearn__scene" aria-hidden="true">
                  <div className="plearn__bubble">조금만 더! 힘내!</div>
                  <div className="plearn__path" />
                  <span className="plearn__mascot plearn__mascot--1">
                    <CharacterArt variant="AVATAR_02" fill="100%" />
                  </span>
                  <span className="plearn__mascot plearn__mascot--2">
                    <CharacterArt variant="AVATAR_01" fill="100%" />
                  </span>
                  <span className="plearn__mascot plearn__mascot--3">
                    <CharacterArt variant="AVATAR_03" fill="100%" />
                  </span>
                </div>
              </>
            );
          }}
        </Async>
      </div>

      {/* Floating chatbot button (fixed above the bottom nav) */}
      <button className="plearn__fab" onClick={() => nav("/ai")} aria-label="AI 챗봇과 자유롭게 대화하기">
        <span className="plearn__fab-face">
          <CharacterArt variant="AVATAR_01" fill="100%" />
        </span>
      </button>
    </div>
  );
}
