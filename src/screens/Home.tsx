import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { dashboardApi } from "../api/endpoints";
import { http } from "../lib/http";
import { useAuth } from "../hooks/auth";
import {
  BellIcon,
  LectureShortcutArt,
  ReviewShortcutArt,
  TopNavChevron,
} from "../components/brand/HomeIcons";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { TrackDashboard } from "../components/TrackDashboard";
import { T, useTranslation } from "../i18n";
import { TopikPartSelectionModal } from "../components/TopikPartSelectionModal";
import {
  AdditionalLearningCountModal,
  type AdditionalCount,
} from "../components/AdditionalLearningCountModal";
import type { DashboardSummary, DashboardTrack, TopikSection } from "../lib/types";
import { settingsOrigin } from "../lib/settingsNav";


/**
 * Greeting — Figma KO 1825:26666 / EN 1825:28613.
 *
 * The emphasis sits in a different place in each language ("00님, 반가워요!"
 * leads with the name; "Welcome, Elsy!" trails it), so the message carries its
 * own emphasis marker rather than the JSX wrapping a fixed position.
 */
function Greeting({ name }: { name: string }) {
  return (
    <h1 className="home__greet">
      <T k="home.greeting" vars={{ name }} />
    </h1>
  );
}

export function Home() {
  const nav = useNavigate();
  const { me } = useAuth();
  const { t } = useTranslation();
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
  const nickname = me?.nickname ?? me?.name ?? t("home.defaultNickname");

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
          <Greeting name={nickname} />
          <button
            className="home__bell"
            onClick={() => nav("/notifications")}
            aria-label={t(unread.data?.has_unread ? "home.notificationsUnread" : "home.notifications")}
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
                  <span className="home__streak-text">
                    {t("home.streak", { days: d.streak_days })}
                  </span>
                  <TopNavChevron />
                </button>

                {tracks.length > 0 && active && (
                  <TrackDashboard
                    tracks={tracks}
                    active={active}
                    tab={tab}
                    onTab={setTab}
                    onSettings={() => nav("/recommend/settings", { state: settingsOrigin("/home") })}
                    ratio={ratio}
                    current={shownCurrent}
                    target={target}
                    done={done}
                    onStart={() => {
                      // TOPIK always picks a part first; the part modal then
                      // chains into the count modal when the goal is done.
                      // Conversation: done -> count modal, else start directly.
                      if (active.category === "topik") {
                        setTopikAdditional(done);
                        setTopikPartOpen(true);
                      } else if (done) {
                        setCountKind("conversation");
                      } else {
                        nav("/session/conversation", { state: { from: "/home" } });
                      }
                    }}
                  />
                )}

                {/* Shortcuts */}
                <div className="home__shortcuts">
                  <button className="home__shortcut" onClick={() => nav("/courses")}>
                    <LectureShortcutArt />
                    <span className="home__shortcut-label">{t("home.shortcutClasses")}</span>
                  </button>
                  <button className="home__shortcut" onClick={() => nav("/saved")}>
                    <ReviewShortcutArt />
                    <span className="home__shortcut-label">{t("home.shortcutReview")}</span>
                  </button>
                </div>

                {/* Non-subscriber promotion */}
                {d.paywall_required && (
                  <button className="home__promo" onClick={() => nav("/subscription/start")}>
                    <span className="home__promo-text">
                      {t("home.promoQuestion")}{" "}
                      <b className="home__promo-hl">{t("home.promoCta")}</b>
                    </span>
                    <TopNavChevron tone="gold" />
                  </button>
                )}
              </>
            );
          }}
        </Async>
      </div>

      <TopikPartSelectionModal
        open={topikPartOpen}
        level={q.data?.tracks.find((tr) => tr.category === "topik")?.level}
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
