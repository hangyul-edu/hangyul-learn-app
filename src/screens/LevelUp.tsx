import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
// Celebratory Hangyul tangerine mascot (graduation cap, open arms, happy face)
// with confetti — inline SVG, matching the repo's brand-asset convention.
function LevelUpMascot() {
  return (
    <div className="lvup__mascot" role="img" aria-label="레벨업을 축하하는 한결 캐릭터">
      <svg viewBox="0 0 220 210" className="lvup__mascot-svg" aria-hidden="true" focusable="false">
        {/* confetti */}
        <g className="lvup__confetti">
          <rect x="24" y="34" width="9" height="9" rx="2" fill="#5FB65B" transform="rotate(18 28 38)" />
          <rect x="182" y="30" width="9" height="9" rx="2" fill="#2F6BFF" transform="rotate(-22 186 34)" />
          <circle cx="46" cy="96" r="5" fill="#FFC24B" />
          <circle cx="176" cy="104" r="5" fill="#EF6B5B" />
          <rect x="150" y="60" width="8" height="8" rx="2" fill="#F2A93B" transform="rotate(25 154 64)" />
          <rect x="58" y="58" width="8" height="8" rx="2" fill="#EF6B5B" transform="rotate(-16 62 62)" />
          <path d="M110 20l2.4 5 5.4.6-4 3.7 1 5.4-4.8-2.7-4.8 2.7 1-5.4-4-3.7 5.4-.6z" fill="#FFC24B" />
        </g>
        {/* soft landing glow */}
        <ellipse cx="110" cy="182" rx="52" ry="12" fill="#F7C98A" opacity="0.45" />
        {/* arms (open) */}
        <path d="M64 120c-14 2-24 10-30 22" stroke="#EE8B2E" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M156 120c14 2 24 10 30 22" stroke="#EE8B2E" strokeWidth="9" strokeLinecap="round" fill="none" />
        {/* body */}
        <ellipse cx="110" cy="120" rx="52" ry="50" fill="#F5872E" />
        <ellipse cx="110" cy="120" rx="52" ry="50" fill="url(#lvupShine)" />
        {/* face */}
        <circle cx="94" cy="118" r="4.6" fill="#3A2418" />
        <circle cx="126" cy="118" r="4.6" fill="#3A2418" />
        <path d="M96 132c4.4 5 19.6 5 24 0" stroke="#3A2418" strokeWidth="4.4" strokeLinecap="round" fill="none" />
        <ellipse cx="82" cy="130" rx="6" ry="4" fill="#FBB27A" opacity="0.85" />
        <ellipse cx="138" cy="130" rx="6" ry="4" fill="#FBB27A" opacity="0.85" />
        {/* graduation cap */}
        <path d="M110 60L70 76l40 16 40-16z" fill="#3F8F3C" />
        <path d="M110 74l24-9.6v14c0 6-11 10-24 10s-24-4-24-10v-14z" fill="#357A33" opacity="0.9" />
        <rect x="150" y="70" width="3" height="20" rx="1.5" fill="#357A33" />
        <circle cx="151.5" cy="92" r="4" fill="#FFC24B" />
        <defs>
          <radialGradient id="lvupShine" cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#FFB56B" stopOpacity="0.9" />
            <stop offset="0.55" stopColor="#FFB56B" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <div className="lvup__bubble" aria-hidden="true">대단한걸!✨</div>
    </div>
  );
}

/* -------------------------------- medal --------------------------------- */
function Medal() {
  return (
    <svg viewBox="0 0 120 120" className="lvup__medal" aria-hidden="true">
      <path d="M44 20l12 30 8-5 8 5 12-30z" fill="#EF6B5B" />
      <path d="M50 20l10 26 10-26z" fill="#D9534A" />
      <circle cx="60" cy="74" r="28" fill="#F2A93B" />
      <circle cx="60" cy="74" r="28" fill="url(#lvupMedalShine)" />
      <circle cx="60" cy="74" r="21" fill="none" stroke="#E1902C" strokeWidth="2.2" />
      <path d="M60 60l4 8.2 9 1.1-6.5 6.2 1.6 8.9L60 88.2 51.9 92.4l1.6-8.9-6.5-6.2 9-1.1L60 60z" fill="#FFF3D6" />
      <defs>
        <radialGradient id="lvupMedalShine" cx="0.38" cy="0.32" r="0.7">
          <stop offset="0" stopColor="#FFD98A" stopOpacity="0.9" />
          <stop offset="0.6" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/* -------------------------------- screen -------------------------------- */
export function LevelUp() {
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
  const unit = isTopik ? "문제" : "문장";

  const headline = isTopik ? `토픽 ${next}급 달성! 🎉` : `레벨 ${next} 달성! 🎉`;
  const prevLabel = isTopik ? `${prev}급` : `Lv.${prev}`;
  const nextLabel = isTopik ? `${next}급` : `Lv.${next}`;
  const duration = fmtDuration(levelUp.seconds_studied_at_previous_level);

  function goNextLevel() {
    // Return to the source page (Home / Personalized) — do NOT auto-start a new
    // session. `replace` so the level-up screen leaves the back stack and can't
    // reappear. The user chooses what to do next from that page.
    nav(from, { replace: true });
  }

  return (
    <div className="screen lvup" role="dialog" aria-modal="true" aria-label="레벨업 결과">
      <div className="lvup__scroll">
        <LevelUpMascot />

        <p className="lvup__eyebrow">{headline}</p>
        <h1 className="lvup__heading">대단해요!<br />한 단계 더 나아갔어요!</h1>

        <div className="lvup__card">
          <div
            className="lvup__pill"
            aria-label={`${isTopik ? "토픽 " : "레벨 "}${prev}${isTopik ? "급" : ""}에서 ${next}${isTopik ? "급" : ""}으로 올라갔어요`}
          >
            <span className="lvup__pill-prev">{prevLabel}</span>
            <span className="lvup__pill-arrow" aria-hidden="true">→</span>
            <span className="lvup__pill-next">{nextLabel}</span>
          </div>

          <Medal />

          <div className="lvup__reward" aria-label={`레벨업 보상 ${levelUp.points_awarded} 포인트`}>
            +{levelUp.points_awarded}p
          </div>

          <div className="lvup__stats">
            <div className="lvup__stat">
              <span className="lvup__stat-label">공부한 시간</span>
              <span className="lvup__stat-value" aria-label={`공부한 시간 ${duration}`}>{duration}</span>
            </div>
            <span className="lvup__stat-divider" aria-hidden="true" />
            <div className="lvup__stat">
              <span className="lvup__stat-label">학습한 {unit}</span>
              <span className="lvup__stat-value" aria-label={`학습한 ${unit} ${levelUp.items_studied_at_previous_level}개`}>
                {levelUp.items_studied_at_previous_level}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="lvup__foot">
        <button className="lvup__cta" onClick={goNextLevel} aria-label="다음 레벨 학습하기">
          다음 레벨 학습하기
        </button>
      </div>
    </div>
  );
}
