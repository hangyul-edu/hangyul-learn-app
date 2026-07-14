import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CharacterArt } from "./brand/ProfileAssets";

/**
 * Shared chrome for the personalized-learning session screens (Conversation +
 * TOPIK): back button, centered title, collapsible AI-customization panel, the
 * daily-learning heading with the blue correct/total pill, the contextual
 * chatbot mascot (with the incorrect-answer bubble), and the session progress
 * bar. Mode-specific content (the AI panel + the exercise) is passed in.
 */
export function SessionChrome({
  title,
  heading,
  correct,
  total,
  progress,
  panel,
  incorrect,
  onAskAi,
  children,
}: {
  title: string;
  heading: string;
  correct: number;
  total: number;
  /** 0–1 session progress (submitted/total). */
  progress: number;
  /** The AI-customization control (Conversation prompt or TOPIK dropdown). */
  panel: ReactNode;
  /** true only after a server-confirmed incorrect answer for the current item. */
  incorrect: boolean;
  onAskAi: () => void;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const shownCorrect = Math.max(0, Math.min(correct, total));

  return (
    <div className="screen sess">
      <div className="sess__scroll">
        <div className="sess__inner">
          <header className="sess__header">
            <button className="sess__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="sess__title">{title}</h1>
          </header>

          {/* Collapsible AI-customization control */}
          <div className={`sess__ai ${collapsed ? "is-collapsed" : ""}`}>
            <button
              className="sess__ai-handle"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "맞춤 설정 펼치기" : "맞춤 설정 접기"}
              aria-expanded={!collapsed}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {!collapsed && <div className="sess__ai-panel">{panel}</div>}
          </div>

          {/* Daily-learning heading + counter + contextual chatbot */}
          <div className="sess__goalrow">
            <div className="sess__goalinfo">
              <p className="sess__goal-heading">{heading}</p>
              <span className="sess__pill" aria-label={`현재 학습 세트 ${total}개 중 ${shownCorrect}개 정답`}>
                {shownCorrect}/{total}
              </span>
            </div>
            <div className="sess__mascot-wrap">
              {incorrect && (
                <span className="sess__bubble" role="status">
                  궁금한 건 나한테 물어봐
                </span>
              )}
              <button
                className="sess__mascot"
                onClick={onAskAi}
                disabled={!incorrect}
                aria-label="AI 튜터에게 이 문제 설명 듣기"
              >
                <span className="sess__mascot-face">
                  <CharacterArt variant="AVATAR_01" fill="100%" />
                </span>
              </button>
            </div>
          </div>

          {/* Session progress bar */}
          <div className="sess__progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="세션 진행률">
            <div className="sess__progress-fill" style={{ width: `${pct}%` }} />
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}
