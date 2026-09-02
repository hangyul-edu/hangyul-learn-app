import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import levelupMascot from "../assets/brand/levelup-mascot.svg";
import levelupMascotTopik from "../assets/brand/levelup-mascot-topik.svg";
import levelupTopikArc from "../assets/brand/levelup-topik-arc.svg";
import levelupBubbleTail from "../assets/brand/levelup-bubble-tail.svg";
import levelupMascotPencil from "../assets/brand/levelup-mascot-pencil.svg";
import levelupConfetti from "../assets/brand/levelup-confetti.svg";
import levelupMedal from "../assets/brand/levelup-medal.svg";
import { useTranslation } from "../i18n";
import { useQueryClient } from "@tanstack/react-query";
import type { SessionLevelUp } from "../lib/types";

/**
 * Level-Up result screen — shown ONLY after a personalized learning session that
 * the server finalized with a level-up, and only after the point-reward summary
 * modal. All values are data-driven from the finalize `level_up` payload passed
 * via navigation state; there is no client-side inference of the level-up.
 */

type TrackName = "conversation" | "topik";
function trackOf(trackId: string): TrackName {
  return trackId === "track_topik" ? "topik" : "conversation";
}
function fmtDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/* ------------------------------- mascot --------------------------------- */
// Celebratory Hangyul tangerine with confetti and a speech bubble. The two
// tracks do NOT share the artwork: TAL-012 draws a bespectacled tangerine
// sitting on an open book, TAL-032 a graduation-cap tangerine mid-jump over a
// blurred ground arc. Both are exported artwork, never redrawn.
function LevelUpMascot({ isTopik }: { isTopik: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="lvup__mascot">
      <span className="lvup__art" role="img" aria-label={t("levelUp.characterA11y")}>
        {/* Confetti field — 231:6869 / 572:23256, identical in both frames. */}
        <img className="lvup__confetti" src={levelupConfetti} alt="" aria-hidden="true" />
        {isTopik ? (
          <>
            {/* 3179:36111 — the export carries the mascot's white glow, so it
                is wider/taller than the 146.9x123.83 node box. */}
            <img
              className="lvup__mascot-art lvup__mascot-art--topik"
              src={levelupMascotTopik}
              alt=""
              aria-hidden="true"
            />
            {/* 3179:36135 — the blurred ground arc the jump lands on. */}
            <img className="lvup__arc" src={levelupTopikArc} alt="" aria-hidden="true" />
          </>
        ) : (
          <>
            <img className="lvup__mascot-art" src={levelupMascot} alt="" aria-hidden="true" />
            {/* 3179:36179 — the pencil is a sibling of the artwork, drawn over
                it, so it is missing from the mascot export. TAL-032 has none. */}
            <img className="lvup__pencil" src={levelupMascotPencil} alt="" aria-hidden="true" />
          </>
        )}
      </span>

      {/* inputField 3179:36143 (TAL-012) / 3179:36109 (TAL-032). Only TAL-032
          draws the pointer tail (Vector 1231, 572:23299). */}
      <p className={`lvup__bubble${isTopik ? " lvup__bubble--topik" : ""}`}>
        {t(isTopik ? "levelUp.bubbleTopik" : "levelUp.bubbleConversation")}
      </p>
      {isTopik && (
        <img className="lvup__bubble-tail" src={levelupBubbleTail} alt="" aria-hidden="true" />
      )}
    </div>
  );
}

/* -------------------------------- medal --------------------------------- */
function Medal() {
  /* Figma 744:46888 — the 27.85x36 medal is exported artwork. */
  return <img className="lvup__medal" src={levelupMedal} alt="" aria-hidden="true" />;
}
/* -------------------------------- screen -------------------------------- */
export function LevelUp() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const state = loc.state as { levelUp?: SessionLevelUp; from?: string } | null;
  const levelUp = state?.levelUp ?? null;
  // The page the session was launched from (Home / Personalized). The button
  // returns the user here; they decide what to do next (it does NOT auto-start
  // another session).
  const from = state?.from ?? "/home";

  // Missing state (direct nav / refresh) → nothing to celebrate; go Home. This
  // also prevents a stale level-up screen from reappearing after a reload.
  useEffect(() => {
    if (!levelUp) nav("/home", { replace: true });
  }, [levelUp, nav]);

  // Reflect the new level everywhere on entry.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["my-learning"] });
    qc.invalidateQueries({ queryKey: ["points"] });
  }, [qc]);

  if (!levelUp) return null;

  const track = trackOf(levelUp.track_id);
  const isTopik = track === "topik";
  const prev = levelUp.previous_level;
  const next = levelUp.current_level;
  const unit = t(isTopik ? "levelUp.unitQuestion" : "levelUp.unitSentence");

  const headline = t(isTopik ? "levelUp.reachedGrade" : "levelUp.reachedLevel", { n: next });
  const prevLabel = isTopik ? t("levelUp.gradeLabel", { n: prev }) : `Lv.${prev}`;
  const nextLabel = isTopik ? t("levelUp.gradeLabel", { n: next }) : `Lv.${next}`;
  const duration = fmtDuration(levelUp.seconds_studied_at_previous_level);

  function goNextLevel() {
    // Return to the source page (Home / Personalized) — do NOT auto-start a new
    // session. `replace` so the level-up screen leaves the back stack and can't
    // reappear. The user chooses what to do next from that page.
    nav(from, { replace: true });
  }

  return (
    <div className="screen lvup" role="dialog" aria-modal="true" aria-label={t("levelUp.resultA11y")}>
      <div className="lvup__scroll">
        <LevelUpMascot isTopik={isTopik} />

        <p className="lvup__eyebrow">{headline}</p>
        {/* Figma sets the praise and the follow-on as one line, not two. */}
        <h1 className="lvup__heading">
          {t("levelUp.praise")} {t("levelUp.title")}
        </h1>

        <div className="lvup__card">
          <div
            className="lvup__pill"
            aria-label={t(isTopik ? "levelUp.fromToGrade" : "levelUp.fromToLevel", { prev, next })}
          >
            <span className="lvup__pill-prev">{prevLabel}</span>
            <span className="lvup__pill-arrow" aria-hidden="true">→</span>
            <span className="lvup__pill-next">{nextLabel}</span>
          </div>

          <Medal />

          <div className="lvup__reward" aria-label={t("levelUp.rewardA11y", { points: levelUp.points_awarded })}>
            +{levelUp.points_awarded}p
          </div>

          <div className="lvup__stats">
            <div className="lvup__stat">
              <span className="lvup__stat-label">{t("levelUp.studyTime")}</span>
              <span className="lvup__stat-value" aria-label={t("levelUp.studyTimeA11y", { duration })}>{duration}</span>
            </div>
            <span className="lvup__stat-divider" aria-hidden="true" />
            <div className="lvup__stat">
              <span className="lvup__stat-label">
                {t(isTopik ? "levelUp.studiedQuestions" : "levelUp.studiedSentences")}
              </span>
              <span className="lvup__stat-value" aria-label={t("levelUp.itemsA11y", { unit, count: levelUp.items_studied_at_previous_level })}>
                {levelUp.items_studied_at_previous_level}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="lvup__foot">
        <button className="lvup__cta" onClick={goNextLevel} aria-label={t("levelUp.nextLevel")}>
          {t("levelUp.nextLevel")}
        </button>
      </div>
    </div>
  );
}
