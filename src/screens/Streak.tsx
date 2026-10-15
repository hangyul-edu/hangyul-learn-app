import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { learnApi } from "../api/endpoints";
import { DailyLearningSun } from "../components/DailyLearningSun";
import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";
// Two assets rather than one rotated one: Polygon 11/12 both cast their shadow
// straight DOWN (dy 2, no dx), and rotating a single glyph in CSS drags its
// baked shadow round with it.
import monthArrowPrev from "../assets/brand/ic-month-arrow-prev.svg";
import monthArrowNext from "../assets/brand/ic-month-arrow-next.svg";
import { useDashboard } from "../api/queries";

const WEEKDAY_KEYS: TranslationKey[] = [
  "streak.sun",
  "streak.mon",
  "streak.tue",
  "streak.wed",
  "streak.thu",
  "streak.fri",
  "streak.sat",
];
const pad = (n: number) => String(n).padStart(2, "0");

type Cell = { day: number; inMonth: boolean; weekday: number; date: string | null };

/** Build a Sunday-first month grid, padding the first/last weeks with adjacent
 *  month days. Pure date math — no timezone shift (cells are keyed by the local
 *  Y-M-D of the viewed month; completion is matched by date string). */
function buildGrid(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevMonthDays = new Date(year, month - 1, 0).getDate();
  const cells: Cell[] = [];
  // HMA-001 greys the adjacent-month days rather than blanking them, so the
  // padding cells carry their real day numbers.
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: prevMonthDays - firstWeekday + 1 + i, inMonth: false, weekday: i, date: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, weekday: (firstWeekday + d - 1) % 7, date: `${year}-${pad(month)}-${pad(d)}` });
  }
  let next = 1;
  while (cells.length % 7 !== 0) cells.push({ day: next++, inMonth: false, weekday: cells.length % 7, date: null });
  return cells;
}

export function Streak() {
  const { t } = useTranslation();
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
  const summary = useDashboard();
  const studiedToday = !!summary.data?.studied_today;

  // Completion markers come straight from the server: the set of dates that
  // qualify as a LEARNING DAY (`studied` — any qualifying activity, all flows),
  // the same rule behind the learning-day count / streak — NOT `goal_achieved`
  // (which requires reaching the daily custom-learning goal). We only key off
  // the server-provided `date` (normalized to YYYY-MM-DD so it matches any time
  // suffix), and only when the loaded month matches the viewed month so a stale
  // response can't mismark. A day on which a sentence / TOPIK question was only
  // displayed (never answered) is a learning day too: the display is recorded
  // through `POST /learning/activity`, which advances the streak and marks the
  // day server-side. Today is additionally union-ed in from the sun's
  // `studied_today` — which `useMarkStudied` lights optimistically the moment
  // an item appears — so the calendar agrees with the sun before a refetch.
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
            <button className="strk__back" onClick={() => nav("/home")} aria-label={t("common.back")}>
              {/* ic_B_topNav variant=back, exactly as HMA-001 exports it —
                  kept identical to the Learning-management header. */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M16 21L7 12L16 3"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <LearningSectionSwitcher current="streak" />
          </header>

          {/* Streak summary banner — copy + sun both key off today's study state. */}
          <div className={`strk__banner${studiedToday ? "" : " strk__banner--inactive"}`}>
            <p className="strk__banner-text">
              {studiedToday ? (
                <>
                  {t("streak.litTitle")}
                  <br />
                  {t("streak.streakDays", { days: streak ?? "…" })}
                </>
              ) : (
                <>
                  {t("streak.unlitTitle")}
                  <br />
                  {t("streak.unlitDesc")}
                </>
              )}
            </p>
            {/* 58, not 50: home-sun.svg's viewBox includes the baked shadow, and
                HMA-001 draws it bleeding 4px past the 50x50 slot on each side. */}
            <span className="strk__banner-sun">
              <DailyLearningSun size={58} />
            </span>
          </div>

          {/* Month navigation */}
          <div className="strk__monthnav">
            <button
              className="strk__arrow strk__arrow--prev"
              onClick={() => step(-1)}
              aria-label={t("streak.prevMonth")}
              disabled={q.isFetching}
            >
              <img src={monthArrowPrev} alt="" aria-hidden="true" />
            </button>
            <div className="strk__month">
              <div className="strk__year">{view.y}</div>
              <div className="strk__month-num" aria-label={t("streak.monthLabel", { y: view.y, m: view.m })}>
                {view.m}
              </div>
            </div>
            {/* Forward is only offered while browsing the past. On the current
                month the control is not rendered at all rather than left in
                place inert: HMA-001 has no dimmed variant of Polygon 11, so a
                disabled one would look identical to a live one. Dropping it also
                keeps it out of the tab order and off screen readers. The arrow
                is absolutely positioned, so nothing reflows when it goes. */}
            {!atCurrentMonth && (
              <button
                className="strk__arrow strk__arrow--next"
                onClick={() => step(1)}
                aria-label={t("streak.nextMonth")}
                disabled={q.isFetching}
              >
                <img src={monthArrowNext} alt="" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Weekday header */}
          <div className="strk__weekdays" aria-hidden="true">
            {WEEKDAY_KEYS.map((w) => (
              <span key={w} className="strk__weekday">
                {t(w)}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="strk__grid" role="grid" aria-label={t("streak.monthAria", { y: view.y, m: view.m })}>
            {grid.map((c, i) => {
              if (!c.inMonth) {
                return (
                  <span key={i} className="strk__cell" aria-hidden="true">
                    <span className="strk__num strk__num--adj">{c.day}</span>
                  </span>
                );
              }
              const isDone = c.date && completed.has(c.date);
              if (isDone) {
                return (
                  <div key={i} className="strk__cell" role="gridcell">
                    <div className="strk__done" aria-label={t("streak.dayDoneA11y", { y: view.y, m: view.m, d: c.day })}>
                      <span className="strk__done-day">{c.day}</span>
                      <span className="strk__done-label">{t("streak.done")}</span>
                    </div>
                  </div>
                );
              }
              const cls =
                c.weekday === 0 ? "strk__num--sun" : c.weekday === 6 ? "strk__num--sat" : "strk__num--wd";
              return (
                <div key={i} className="strk__cell" role="gridcell">
                  <span className={`strk__num ${cls}`} aria-label={t("streak.dayA11y", { y: view.y, m: view.m, d: c.day })}>
                    {c.day}
                  </span>
                </div>
              );
            })}
          </div>

          {q.isError && (
            <div className="strk__error">
              <p className="muted">{t("streak.loadError")}</p>
              <button className="btn btn--secondary btn--sm" onClick={() => q.refetch()}>
                {t("common.retry")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
