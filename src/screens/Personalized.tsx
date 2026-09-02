import { useState } from "react";
import { useNavigate } from "react-router-dom";
import practiceBand from "../assets/brand/practice-band.svg";
import chatbotFab from "../assets/brand/chatbot-fab.svg";
/* Review-shortcut pill glyphs, exported from TAL-001 (1825:29265 / 1825:29268 /
   1825:29266) rather than redrawn. */
import icRepeat from "../assets/brand/ic-16-repeat.svg";
import icStar from "../assets/brand/ic-16-star.svg";
/* TAL-001 1825:29266/29270 use the RIGHT-pointing ic_16_arrow variant
   (M6 3L10.5 7.5L6 12, Gray 5, round caps) — not the downward one the
   post-answer sheet uses. */
import icArrowRight from "../assets/brand/ic-16-arrow-right.svg";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Async, SkeletonList } from "../components/ui/states";
import { dashboardApi } from "../api/endpoints";
import { ReviewShortcutArt } from "../components/brand/HomeIcons";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { TrackDashboard } from "../components/TrackDashboard";
import { ChatbotBottomSheet } from "../components/ChatbotBottomSheet";
import { TopikPartSelectionModal } from "../components/TopikPartSelectionModal";
import {
  AdditionalLearningCountModal,
  type AdditionalCount,
} from "../components/AdditionalLearningCountModal";
import type { DashboardSummary, DashboardTrack, TopikSection } from "../lib/types";

export function Personalized() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  // Entitlement for additional learning: the server-authoritative premium flag.
  // `paywall_required` is `!has_premium_access`, true for a paid / trial / coupon
  // subscription AND for an admin or tester role (the same gate the additional-
  // learning API enforces).
  const entitled = q.data?.paywall_required === false;
  const [chatOpen, setChatOpen] = useState(false);
  const [topikPartOpen, setTopikPartOpen] = useState(false);
  // Additional-learning flow (only after the daily goal is 100%).
  const [countKind, setCountKind] = useState<"conversation" | "topik" | null>(null);
  const [pendingSection, setPendingSection] = useState<TopikSection | null>(null);
  const [topikAdditional, setTopikAdditional] = useState(false);
  const [tab, setTab] = useState(0);

  function startAdditional(count: AdditionalCount) {
    const kind = countKind;
    setCountKind(null);
    if (!entitled) {
      nav("/subscription/start");
      return;
    }
    if (kind === "topik") {
      nav("/session/topik", {
        state: { from: "/recommend", section: pendingSection, additionalCount: count },
      });
    } else {
      nav("/session/conversation", { state: { from: "/recommend", additionalCount: count } });
    }
  }

  return (
    <div className="screen plearn">
      <div className="screen__body screen__body--nav plearn__body">
        {/* Header and gap sit at the body's own flex level, not inside the
            stack: the gap is the single elastic item on the screen, and it can
            only be bounded (31px -> 0, then the frame scrolls) if the flex
            algorithm sees it as a sibling of the things it has to make room
            for. It reads q.data directly so the title also survives the loading
            and error states. */}
        <header className="plearn__header">
          <h1 className="plearn__title">{t("personalized.title")}</h1>
          {q.data && (
            <button className="plearn__streak" onClick={() => nav("/streak")} aria-label={t("personalized.streakCalendarA11y", { days: q.data.streak_days })}>
              <DailyLearningSun size={14} />
              <span>{q.data.streak_days}</span>
            </button>
          )}
        </header>

        {/* TAL-001's 31px between the title (85) and the tab strip (116), as the
            one piece of give in the column. On a short frame it collapses toward
            0, sliding tabs/card/review/band up together by a single amount;
            nothing else shrinks, so the sections keep their Figma spacing
            relative to each other. */}
        <div className="plearn__gap" aria-hidden="true" />

        {/* Block wrapper so the tab/card/review margins keep collapsing as they
            did before the body became a flex column. */}
        <div className="plearn__stack">
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
            // Show the true count, including additional-learning overage past the
            // goal (e.g. 7/5) — only the gauge fill (ratio→pct) is clamped to 100%.
            const shown = cur;
            const ratio = target ? cur / target : 0;

            return (
              <>

                {tracks.length > 0 && active && (
                  <TrackDashboard
                    tracks={tracks}
                    active={active}
                    tab={tab}
                    onTab={setTab}
                    onSettings={() => nav("/recommend/settings")}
                    ratio={ratio}
                    current={shown}
                    target={target}
                    done={done}
                    onStart={() => {
                      if (active.category === "topik") {
                        setTopikAdditional(done);
                        setTopikPartOpen(true);
                      } else if (done) {
                        setCountKind("conversation");
                      } else {
                        nav("/session/conversation", { state: { from: "/recommend" } });
                      }
                    }}
                  />
                )}

                {/* Review card */}
                <section className="plearn__review">
                  <ReviewShortcutArt />
                  <span className="plearn__review-title">{t("personalized.review")}</span>
                  <div className="plearn__review-actions">
                    <button
                      className="plearn__review-pill"
                      /* No `tab` — Saved opens on the Practice Settings priority. */
                      onClick={() => nav("/saved", { state: { filter: "auto_wrong" } })}
                      aria-label={t("personalized.retryWrong")}
                    >
                      <img className="plearn__review-icon" src={icRepeat} alt="" aria-hidden="true" />
                      <img className="plearn__review-arrow" src={icArrowRight} alt="" aria-hidden="true" />
                    </button>
                    <button
                      className="plearn__review-pill"
                      onClick={() => nav("/saved", { state: { filter: "favorite" } })}
                      aria-label={t("personalized.reviewFavorites")}
                    >
                      <img className="plearn__review-icon plearn__review-icon--star" src={icStar} alt="" aria-hidden="true" />
                      <img className="plearn__review-arrow" src={icArrowRight} alt="" aria-hidden="true" />
                    </button>
                  </div>
                </section>

              </>
            );
          }}
        </Async>
        </div>

        {/* Decorative band — the exported Figma artwork (TAL-001 Group 1410118913,
            1825:29117): peach ground with the wave contour, three tangerine
            characters and the bubbles, as one asset. Only the encouragement
            bubble is code, since its text is dynamic.

            Last flow child with `margin-top: auto`, so it sits on the nav while
            there is room and otherwise just follows the review card. Pinning it
            absolutely put it on the nav at every size, but on a short-and-wide
            frame that drove it up over the review card. */}
        <div className="plearn__scene">
          <img className="plearn__scene-art" src={practiceBand} alt="" aria-hidden="true" />
          {/* Rectangle 25923 (1825:29301) — a warm-white wash over the band's
              lower half so the art dissolves into the nav, not a cut. */}
          <div className="plearn__scene-fade" aria-hidden="true" />
          <div className="plearn__bubble">{t("personalized.keepGoing")}</div>
        </div>
      </div>

      {/* Floating chatbot button (fixed above the bottom nav) — opens the
          shared chatbot bottom sheet in place, not a separate route. */}
      {/* Figma TAL-001 Group 1410118481 (1825:29302) — 62px, exported whole
          (ring + character), not redrawn. */}
      <button className="plearn__fab" onClick={() => setChatOpen(true)} aria-label={t("personalized.chatbotA11y")}>
        <img className="plearn__fab-art" src={chatbotFab} alt="" aria-hidden="true" />
      </button>

      <ChatbotBottomSheet open={chatOpen} source="personalized_learning" onClose={() => setChatOpen(false)} />

      <TopikPartSelectionModal
        open={topikPartOpen}
        onClose={() => setTopikPartOpen(false)}
        onStart={(part) => {
          setTopikPartOpen(false);
          if (topikAdditional) {
            setPendingSection(part);
            setCountKind("topik");
          } else {
            nav("/session/topik", { state: { from: "/recommend", section: part } });
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
