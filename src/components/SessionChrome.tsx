import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { AskAiSheet, type AskContext } from "./AskAiSheet";
import icAiHandle from "../assets/brand/ic-ai-handle.svg";
import chatbotFab from "../assets/brand/chatbot-fab.svg";

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
  const { t } = useTranslation();
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
            <button className="sess__back" onClick={onBack ?? (() => nav(-1))} aria-label={t("session.backA11y")}>
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
                aria-label={t(collapsed ? "session.expandInput" : "session.collapseInput")}
                aria-expanded={!collapsed}
              >
                {/* Group 1410118858 (1049:19884) — the whole 23x41 tab is one
                    exported asset: the #FFBE33 r8 rectangle with the chevron
                    already centred in it. It used to be a 25x25 hand-drawn
                    chevron laid over a CSS rectangle, which overflowed the
                    23px-wide tab. The art points right (collapse); mirror it
                    for the expand direction. */}
                <img
                  className="sess__ai-handle-ic"
                  src={icAiHandle}
                  alt=""
                  aria-hidden="true"
                  width={23}
                  height={41}
                  style={collapsed ? { transform: "scaleX(-1)" } : undefined}
                />
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
                <span className="sess__pill" aria-label={t("session.scoreA11y", { total, correct: shownCorrect })}>
                  {shownCorrect}/{total}
                </span>
              </div>
            )}
            <div className="sess__mascot-wrap">
              {askContext?.bubble && (
                <button className="sess__bubble" onClick={() => setSheetOpen(true)} aria-label={t("session.askAiA11y")}>
                  {t("session.askAiHint")}
                </button>
              )}
              <button
                className="sess__mascot"
                onClick={() => askContext && setSheetOpen(true)}
                disabled={!askContext}
                aria-label={t("session.askAiA11y")}
              >
                {/* The mascot here IS the chatbot entry point, and TAL-005
                    places Group 1410118481 at (307,171) — the same group the
                    Personalized FAB and the AI message avatar already render
                    from chatbot-fab.svg. Reuse that one asset (ring, character
                    and shadow all baked in) rather than the AVATAR_01 profile
                    character this used to draw. */}
                <img className="sess__mascot-art" src={chatbotFab} alt="" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Session progress bar — omitted in single-item review mode. */}
          {!minimal && (
            <div className="sess__progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("session.progressA11y")}>
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
