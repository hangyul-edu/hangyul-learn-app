import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CharacterArt } from "./brand/ProfileAssets";
import { AskAiSheet, type AskContext } from "./AskAiSheet";

/**
 * Shared chrome for the personalized-learning session screens (Conversation +
 * TOPIK): back button, centered title, collapsible AI-customization panel, the
 * daily-learning heading with the blue correct/total pill, the contextual
 * chatbot mascot (with the incorrect-answer bubble + explanation sheet), and the
 * session progress bar. Mode-specific content (the AI panel + exercise) passed in.
 *
 * The mascot/bubble is active only when `askContext` is set (i.e. after a
 * server-confirmed incorrect answer for the current attempt); tapping either
 * opens the context-anchored explanation sheet.
 */
export function SessionChrome({
  title,
  heading = "",
  correct = 0,
  total = 0,
  progress = 0,
  panel = null,
  askContext,
  onBack,
  minimal = false,
  children,
}: {
  title: string;
  heading?: string;
  correct?: number;
  total?: number;
  /** 0–1 session progress (submitted/total). */
  progress?: number;
  /** The AI-customization control (Conversation prompt or TOPIK dropdown). */
  panel?: ReactNode;
  /** Explanation context — present only after a server-confirmed incorrect
   *  answer for the current attempt; null otherwise (mascot inactive). */
  askContext: AskContext | null;
  /** Back-chevron handler — runs the same completion/exit flow as the CTA so
   *  exiting via back shows the summary modal when applicable. */
  onBack?: () => void;
  /** Single-item review mode: hides the AI-customization panel, the daily
   *  heading + counter, and the progress bar (keeping the header + chatbot). */
  minimal?: boolean;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const shownCorrect = Math.max(0, Math.min(correct, total));

  // Close the sheet when there is no current item so a stale chat can't linger.
  useEffect(() => {
    if (!askContext) setSheetOpen(false);
  }, [askContext]);

  return (
    <div className={`screen sess ${minimal ? "sess--minimal" : ""}`}>
      <div className="sess__scroll">
        <div className="sess__inner">
          <header className="sess__header">
            <button className="sess__back" onClick={onBack ?? (() => nav(-1))} aria-label="뒤로">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <h1 className="sess__title">{title}</h1>
          </header>

          {/* Collapsible AI-customization control. Expanded: handle on the left,
              panel to its right. Collapsed: only the handle, right-aligned. The
              region keeps a stable height so surrounding content never jumps.
              Hidden entirely in single-item review mode. */}
          {!minimal && (
            <div className={`sess__ai ${collapsed ? "is-collapsed" : ""}`}>
              <button
                className="sess__ai-handle"
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "맞춤 설정 입력창 펼치기" : "맞춤 설정 입력창 접기"}
                aria-expanded={!collapsed}
              >
                <svg width="25" height="25" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  {/* Arrow shows the NEXT action: collapsed → expand (points left);
                      expanded → collapse (points right). */}
                  <path
                    d={collapsed ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
                    stroke="#fff"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {!collapsed && <div className="sess__ai-panel">{panel}</div>}
            </div>
          )}

          {/* Daily-learning heading + counter + contextual chatbot. In review mode
              the heading + counter are dropped; the chatbot stays. */}
          <div className="sess__goalrow">
            {!minimal && (
              <div className="sess__goalinfo">
                <p className="sess__goal-heading">{heading}</p>
                <span className="sess__pill" aria-label={`현재 학습 세트 ${total}개 중 ${shownCorrect}개 정답`}>
                  {shownCorrect}/{total}
                </span>
              </div>
            )}
            <div className="sess__mascot-wrap">
              {askContext?.bubble && (
                <button className="sess__bubble" onClick={() => setSheetOpen(true)} aria-label="현재 문제를 한귤AI에게 물어보기">
                  헷갈린 부분 내가 알려줄게!
                </button>
              )}
              <button
                className="sess__mascot"
                onClick={() => askContext && setSheetOpen(true)}
                disabled={!askContext}
                aria-label="현재 문제를 한귤AI에게 물어보기"
              >
                <span className="sess__mascot-face">
                  <CharacterArt variant="AVATAR_01" fill="100%" />
                </span>
              </button>
            </div>
          </div>

          {/* Session progress bar — omitted in single-item review mode. */}
          {!minimal && (
            <div className="sess__progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="세션 진행률">
              <div className="sess__progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}

          {minimal ? <div className="sess__minbody">{children}</div> : children}
        </div>
      </div>

      {/* Context-anchored explanation sheet. Keyed per attempt so a new problem
          gets a fresh conversation and late responses can't cross over. */}
      {askContext && (
        <AskAiSheet
          key={askContext.contextId}
          open={sheetOpen}
          context={askContext}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}
