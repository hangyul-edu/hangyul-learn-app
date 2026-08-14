import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { dashboardApi } from "../api/endpoints";
import { http } from "../lib/http";
import { useAuth } from "../hooks/auth";
import {
  BellIcon,
  SpeakingIcon,
  PencilIcon,
  GearIcon,
  PlayIcon,
  BookIcon,
  ChevronRight,
} from "../components/brand/HomeIcons";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { TopikPartSelectionModal } from "../components/TopikPartSelectionModal";
import {
  AdditionalLearningCountModal,
  type AdditionalCount,
} from "../components/AdditionalLearningCountModal";
import type { DashboardSummary, DashboardTrack, TopikSection } from "../lib/types";

/** Icon for a learning track's tab, chosen from its stable category. */
function trackIcon(category: string, size = 30) {
  if (category === "topik") return <PencilIcon size={size} />;
  return <SpeakingIcon size={size} />;
}

/** Open horseshoe progress gauge with the percentage centered. When complete
 *  the arc turns celebratory yellow; otherwise it uses brand orange. */
function DailyGauge({ ratio, done }: { ratio: number; done: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const arcColor = done ? "#FFB91F" : "#FF5B00";
  const r = 78;
  const cx = 100;
  const cy = 100;
  // Arc from ~135° to ~405° (270° sweep, gap at the bottom).
  const start = 135;
  const sweep = 270;
  const circ = 2 * Math.PI * r;
  const arcLen = (sweep / 360) * circ;
  const filled = (pct / 100) * arcLen;
  const pol = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
  };
  const largeArc = sweep > 180 ? 1 : 0;
  const d = `M ${pol(start)} A ${r} ${r} 0 ${largeArc} 1 ${pol(start + sweep)}`;
  return (
    <div className="home__gauge">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <path d={d} fill="none" stroke="#fff" strokeWidth="20" strokeLinecap="round" />
        {pct > 0 && (
          <path
            d={d}
            fill="none"
            stroke={arcColor}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${arcLen}`}
          />
        )}
      </svg>
      <div className="home__gauge-val">
        <span className="home__gauge-num">{pct}</span>
        <span className="home__gauge-pct">%</span>
      </div>
    </div>
  );
}

function hello(name: string) {
  return (
    <h1 className="home__greet">
      <b>{name}님</b>, 반가워요!
    </h1>
  );
}

export function Home() {
  const nav = useNavigate();
  const { me } = useAuth();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const unread = useQuery({
    queryKey: ["notif-unread"],
    queryFn: () => http.get<{ has_unread: boolean }>("/notifications/unread"),
    staleTime: 30_000,
  });
  // Entitlement for additional learning: the server-authoritative premium flag.
  // `paywall_required` is `!has_premium_access`, which is true for a paid / trial
  // / coupon subscription AND for an admin or tester role (the same gate the
  // additional-learning API enforces), so no separate role check is needed.
  const entitled = q.data?.paywall_required === false;

  const [tab, setTab] = useState(0);
  const [topikPartOpen, setTopikPartOpen] = useState(false);
  // Additional-learning flow (only after the daily goal is 100%): the count
  // modal's kind (null = closed), the TOPIK section chosen just before it, and
  // whether the TOPIK part-modal should chain into the count modal.
  const [countKind, setCountKind] = useState<"conversation" | "topik" | null>(null);
  const [pendingSection, setPendingSection] = useState<TopikSection | null>(null);
  const [topikAdditional, setTopikAdditional] = useState(false);
  const nickname = me?.nickname ?? me?.name ?? "회원";

  // Confirming the count modal: unsubscribed → subscription screen (no session
  // created / no API call); subscribed → start a new additional session of the
  // chosen size. The daily goal is untouched.
  function startAdditional(count: AdditionalCount) {
    const kind = countKind;
    setCountKind(null);
    if (!entitled) {
      nav("/subscription/start");
      return;
    }
    if (kind === "topik") {
      nav("/session/topik", {
        state: { from: "/home", section: pendingSection, additionalCount: count },
      });
    } else {
      nav("/session/conversation", { state: { from: "/home", additionalCount: count } });
    }
  }

  return (
    <div className="screen home">
      <div className="screen__body screen__body--nav home__body">
        <header className="home__header">
          {hello(nickname)}
          <button
            className="home__bell"
            onClick={() => nav("/notifications")}
            aria-label={unread.data?.has_unread ? "알림, 새 알림 있음" : "알림"}
          >
            <BellIcon />
            {unread.data?.has_unread && <span className="home__bell-dot" aria-hidden="true" />}
          </button>
        </header>

        <Async
          loading={q.isLoading}
          error={q.error}
          data={q.data}
          onRetry={() => q.refetch()}
          skeleton={<SkeletonList rows={3} height={120} />}
        >
          {(d: DashboardSummary) => {
            const tracks = d.tracks;
            const active: DashboardTrack | undefined = tracks[Math.min(tab, tracks.length - 1)];
            const target = active?.goal.target ?? 0;
            const rawCurrent = active?.goal.current ?? 0;
            // Completed = authoritative flag AND a valid goal reached (guards
            // against a zero/absent goal). Evaluated for the SELECTED track only.
            const done = !!active && target > 0 && (active.goal.achieved || rawCurrent >= target);
            // Show the true count, including additional-learning overage past the
            // goal (e.g. 7/5) — only the gauge fill (ratio→pct) is clamped to 100%.
            const shownCurrent = rawCurrent;
            const ratio = target ? rawCurrent / target : 0;
            return (
              <>
                {/* Streak */}
                <button className="home__streak" onClick={() => nav("/streak")}>
                  <DailyLearningSun size={50} />
                  <span className="home__streak-text">연속 학습 {d.streak_days}일째</span>
                  <ChevronRight size={22} />
                </button>

                {tracks.length > 0 && active && (
                  <>
                    {/* Learning-mode tabs (driven by real tracks) */}
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
                      <button
                        className="home__tab home__tab--muted"
                        onClick={() => nav("/recommend/settings")}
                        aria-label="맞춤 학습 설정"
                      >
                        <GearIcon />
                      </button>
                    </div>

                    {/* Hero learning card (in-progress / completed states) */}
                    <section
                      className={`home__hero ${done ? "is-done" : ""}`}
                      aria-label={`${active.name} 학습 현황`}
                    >
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
                            aria-label={`${active.goal.label || "하루 목표"} ${target}개 중 ${shownCurrent}개 완료, ${Math.min(100, Math.round(ratio * 100))}퍼센트`}
                          >
                            <span className="home__hero-goal-label">{active.goal.label || "하루 목표"}</span>
                            <span className="home__hero-goal-frac">
                              {shownCurrent}/{target}
                            </span>
                          </div>
                        </div>
                        <DailyGauge ratio={ratio} done={done} />
                      </div>
                      <button
                        className="home__hero-cta"
                        onClick={() => {
                          // TOPIK always picks a part first; the part modal then
                          // chains into the count modal when the goal is done.
                          // Conversation: done → count modal, else start directly.
                          if (active.category === "topik") {
                            setTopikAdditional(done);
                            setTopikPartOpen(true);
                          } else if (done) {
                            setCountKind("conversation");
                          } else {
                            nav("/session/conversation", { state: { from: "/home" } });
                          }
                        }}
                      >
                        {done ? "추가 학습하기" : rawCurrent > 0 ? "이어서 학습하기" : "바로 시작하기"}
                      </button>
                    </section>
                  </>
                )}

                {/* Shortcuts */}
                <div className="home__shortcuts">
                  <button className="home__shortcut" onClick={() => nav("/courses")}>
                    <span className="home__shortcut-play">
                      <PlayIcon />
                    </span>
                    <span className="home__shortcut-label">강의</span>
                  </button>
                  <button className="home__shortcut" onClick={() => nav("/saved")}>
                    <BookIcon size={62} />
                    <span className="home__shortcut-label">복습하기</span>
                  </button>
                </div>

                {/* Non-subscriber promotion */}
                {d.paywall_required && (
                  <button className="home__promo" onClick={() => nav("/subscription/start")}>
                    <span className="home__promo-text">
                      아직 한귤 구독 전이라면? <b className="home__promo-hl">지금 바로 구독하세요!</b>
                    </span>
                    <ChevronRight size={20} color="#FFD227" />
                  </button>
                )}
              </>
            );
          }}
        </Async>
      </div>

      <TopikPartSelectionModal
        open={topikPartOpen}
        onClose={() => setTopikPartOpen(false)}
        onStart={(part) => {
          setTopikPartOpen(false);
          if (topikAdditional) {
            // Goal already done → chain into the additional-count modal.
            setPendingSection(part);
            setCountKind("topik");
          } else {
            nav("/session/topik", { state: { from: "/home", section: part } });
          }
        }}
      />

      <AdditionalLearningCountModal
        open={countKind !== null}
        kind={countKind ?? "conversation"}
        onClose={() => setCountKind(null)}
        onStart={startAdditional}
      />
    </div>
  );
}
