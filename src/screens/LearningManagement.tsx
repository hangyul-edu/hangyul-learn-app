import { useNavigate } from "react-router-dom";

import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";

/**
 * Learning Management (학습 관리) page. Reached from the page-title dropdown on
 * the Continuous Learning (연속 학습) page. Shares the same header/switcher so the
 * two sections switch symmetrically. Body content is an intentionally minimal
 * scaffold — this change is scoped to the section switcher + navigation.
 */
export function LearningManagement() {
  const nav = useNavigate();
  return (
    <div className="screen strk">
      <div className="strk__scroll">
        <div className="strk__inner">
          <header className="strk__header">
            <button className="strk__back" onClick={() => nav("/home")} aria-label="뒤로">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <LearningSectionSwitcher current="management" />
          </header>

          <div className="lmgmt__body">
            <p className="lmgmt__lead">학습 관리</p>
            <p className="lmgmt__hint">학습 기록을 관리할 수 있는 공간이에요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
