import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi, learnApi } from "../api/endpoints";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

type Cell = { day: number; inMonth: boolean; weekday: number; date: string | null };

/** Build a Sunday-first month grid, padding the first/last weeks with adjacent
 *  month days. Pure date math — no timezone shift (cells are keyed by the local
 *  Y-M-D of the viewed month; completion is matched by date string). */
function buildGrid(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Cell[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: 0, inMonth: false, weekday: i, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, weekday: (firstWeekday + d - 1) % 7, date: `${year}-${pad(month)}-${pad(d)}` });
  }
  while (cells.length % 7 !== 0) cells.push({ day: 0, inMonth: false, weekday: cells.length % 7, date: null });
  return cells;
}

export function Streak() {
  const nav = useNavigate();
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  const q = useQuery({
    queryKey: ["streak-calendar", view.y, view.m],
    queryFn: () => learnApi.streakCalendar(view.y, view.m),
    placeholderData: keepPreviousData,
  });

  const grid = useMemo(() => buildGrid(view.y, view.m), [view]);
  const streak = q.data?.current_streak;

  // The banner's active/inactive state — and today's calendar marker — are
  // driven by the SAME shared ["dashboard"] query (and the same `studied_today`
  // field) as the global sun, so they can never disagree. While it's first
  // loading we treat the state as not-yet-studied, matching the sun's dimmed
  // off state.
  const summary = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi.summary });
  const studiedToday = !!summary.data?.studied_today;

  // Completion markers come straight from the server: the set of dates that
  // qualify as a LEARNING DAY (`studied` — any qualifying activity, all flows),
  // the same rule behind the learning-day count / streak — NOT `goal_achieved`
  // (which requires reaching the daily custom-learning goal). We only key off
  // the server-provided `date` (normalized to YYYY-MM-DD so it matches any time
  // suffix), and only when the loaded month matches the viewed month so a stale
  // response can't mismark. Today is additionally union-ed in from the sun's
  // `studied_today` so a view-only day (which advances the streak/sun before any
  // counted attempt) is marked consistently with the rest of the app.
  const completed = useMemo(() => {
    const dates = new Set<string>();
    const m = q.data?.month;
    if (m && m.year === view.y && m.month === view.m) {
      for (const d of m.days) if (d.studied) dates.add(d.date.slice(0, 10));
    }
    if (studiedToday) {
      const now = new Date();
      if (now.getFullYear() === view.y && now.getMonth() + 1 === view.m) {
        dates.add(`${view.y}-${pad(view.m)}-${pad(now.getDate())}`);
      }
    }
    return dates;
  }, [q.data, view, studiedToday]);

  // History view: don't browse into future months.
  const atCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth() + 1;
  const step = (delta: number) =>
    setView((v) => {
      const idx = v.y * 12 + (v.m - 1) + delta;
      return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
    });

  return (
    <div className="screen strk">
      <div className="strk__scroll">
        <div className="strk__inner">
          <header className="strk__header">
            <button className="strk__back" onClick={() => nav(-1)} aria-label="뒤로">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <LearningSectionSwitcher current="streak" />
          </header>

          {/* Streak summary banner — copy + sun both key off today's study state. */}
          <div className={`strk__banner${studiedToday ? "" : " strk__banner--inactive"}`}>
            <p className="strk__banner-text">
              {studiedToday ? (
                <>
                  연속 학습으로 태양이 빛나는 중
                  <br />
                  꾸준히 {streak ?? "…"}일!
                </>
              ) : (
                <>
                  연속 학습이 멈췄어요
                  <br />
                  학습하면 태양이 다시 빛날 거예요!
                </>
              )}
            </p>
            <span className="strk__banner-sun">
              <DailyLearningSun size={56} />
            </span>
          </div>

          {/* Month navigation */}
          <div className="strk__monthnav">
            <button
              className="strk__arrow"
              onClick={() => step(-1)}
              aria-label="이전 달"
              disabled={q.isFetching}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16 4L8 12l8 8z" fill="#FF5B00" />
              </svg>
            </button>
            <div className="strk__month">
              <div className="strk__year">{view.y}</div>
              <div className="strk__month-num" aria-label={`${view.y}년 ${view.m}월`}>
                {view.m}
              </div>
            </div>
            <button
              className="strk__arrow"
              onClick={() => step(1)}
              aria-label="다음 달"
              disabled={atCurrentMonth || q.isFetching}
              aria-disabled={atCurrentMonth}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 4l8 8-8 8z" fill={atCurrentMonth ? "#E1E4E6" : "#FF5B00"} />
              </svg>
            </button>
          </div>

          {/* Weekday header */}
          <div className="strk__weekdays" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w} className="strk__weekday">
                {w}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="strk__grid" role="grid" aria-label={`${view.y}년 ${view.m}월 학습 달력`}>
            {grid.map((c, i) => {
              if (!c.inMonth) {
                return (
                  <span key={i} className="strk__cell strk__cell--adj" aria-hidden="true">
                    {/* adjacent-month spacer keeps columns aligned */}
                  </span>
                );
              }
              const isDone = c.date && completed.has(c.date);
              if (isDone) {
                return (
                  <div key={i} className="strk__cell" role="gridcell">
                    <div className="strk__done" aria-label={`${view.y}년 ${view.m}월 ${c.day}일, 학습 완료`}>
                      <span className="strk__done-day">{c.day}</span>
                      <span className="strk__done-label">완료</span>
                    </div>
                  </div>
                );
              }
              const cls =
                c.weekday === 0 ? "strk__num--sun" : c.weekday === 6 ? "strk__num--sat" : "strk__num--wd";
              return (
                <div key={i} className="strk__cell" role="gridcell">
                  <span className={`strk__num ${cls}`} aria-label={`${view.y}년 ${view.m}월 ${c.day}일`}>
                    {c.day}
                  </span>
                </div>
              );
            })}
          </div>

          {q.isError && (
            <div className="strk__error">
              <p className="muted">학습 기록을 불러오지 못했어요.</p>
              <button className="btn btn--secondary btn--sm" onClick={() => q.refetch()}>
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
