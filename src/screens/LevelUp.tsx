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
import type { ProficiencyCelebration } from "../lib/types";

/**
 * Level-Up result screen — shown ONLY after the server applied an
 * evidence-based proficiency decision: a confirmed conversation level or a
 * confirmed TOPIK readiness grade. Completing items or finishing a session no
 * longer leads here (that activity-based level-up is retired). All values come
 * from the decision passed via navigation state; nothing is inferred
 * client-side.
 */

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
  const state = loc.state as { celebration?: ProficiencyCelebration } | null;
  const levelUp = state?.celebration ?? null;
  // Where the button returns: the proficiency page, which shows the evidence.
  const from = levelUp?.from ?? "/home";

  // Missing state (direct nav / refresh) → nothing to celebrate; go Home. This
  // also prevents a stale level-up screen from reappearing after a reload.
  useEffect(() => {
    if (!levelUp) nav("/home", { replace: true });
  }, [levelUp, nav]);

  // Reflect the new level everywhere on entry.
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["proficiency"] });
    qc.invalidateQueries({ queryKey: ["points"] });
  }, [qc]);

  if (!levelUp) return null;

  const isTopik = levelUp.track === "topik";
  const prev = levelUp.from_level;
  const next = levelUp.to_level;

  const headline = t(isTopik ? "levelUp.confirmedGrade" : "levelUp.confirmedLevel", { n: next });
  const label = (n: number) => (isTopik ? t("levelUp.gradeLabel", { n }) : `Lv.${n}`);
  const prevLabel = prev != null ? label(prev) : "—";
  const nextLabel = label(next);

  function goNextLevel() {
    // `replace` so the celebration leaves the back stack and can't reappear.
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
            aria-label={t(isTopik ? "levelUp.fromToGrade" : "levelUp.fromToLevel", { prev: prev ?? "—", next })}
          >
            <span className="lvup__pill-prev">{prevLabel}</span>
            <span className="lvup__pill-arrow" aria-hidden="true">→</span>
            <span className="lvup__pill-next">{nextLabel}</span>
          </div>

          <Medal />

          <div className="lvup__reward" aria-label={t("levelUp.rewardA11y", { points: levelUp.reward_points })}>
            +{levelUp.reward_points}p
          </div>

          {/* What the decision rested on — assessment evidence, never time or
              item counts. */}
          {isTopik ? (
            <p className="lvup__basis">{t("levelUp.basisTopik")}</p>
          ) : (
            <div className="lvup__stats">
              <div className="lvup__stat">
                <span className="lvup__stat-label">{t("levelUp.capabilitiesConfirmed")}</span>
                <span
                  className="lvup__stat-value"
                  aria-label={t("levelUp.capabilitiesA11y", { count: levelUp.capabilities_confirmed })}
                >
                  {levelUp.capabilities_confirmed}
                </span>
              </div>
            </div>
          )}
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
