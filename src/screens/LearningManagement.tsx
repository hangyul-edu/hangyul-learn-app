import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { learnApi } from "../api/endpoints";
import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";
import { Button } from "../components/ui/kit";
import { ErrorState } from "../components/ui/states";
import type { ManagementPeriod, ManagementStats } from "../lib/types";

const PERIODS: { id: ManagementPeriod; label: string }[] = [
  { id: "7d", label: "최근 7일" },
  { id: "1m", label: "이번달" },
  { id: "3m", label: "최근 3개월" },
  { id: "1y", label: "최근 1년" },
];

/** Seconds → "HH:MM" (summary card). */
function fmtHHMM(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}
/** Seconds → compact "1h33m" / "33m" (chart bar value). */
function fmtShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

const BROWSER_TZ =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

export function LearningManagement() {
  const nav = useNavigate();
  const navigatingRef = useRef(false);
  const [period, setPeriod] = useState<ManagementPeriod>("7d");
  const [periodOpen, setPeriodOpen] = useState(false);

  const q = useQuery({
    queryKey: ["management", period],
    queryFn: () => learnApi.management(period, BROWSER_TZ),
    placeholderData: keepPreviousData,
  });
  const data = q.data;
  // keepPreviousData still holds the previous period while the new one loads —
  // treat that as stale so old buckets never render under the new label.
  const chartStale = !data || data.period !== period;

  function startLearning() {
    if (navigatingRef.current) return; // guard rapid double taps
    navigatingRef.current = true;
    nav("/recommend");
  }

  const empty = !!data && !data.has_any_eligible_learning_record;
  const headline = empty ? "첫 학습을 기다리고 있어요!" : "꾸준히 쌓이는 기록, 대단해요!";

  return (
    <div className="screen lmgmt">
      <div className="lmgmt__scroll">
        <header className="strk__header lmgmt__header">
          <button className="strk__back" onClick={() => nav("/home")} aria-label="뒤로">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <LearningSectionSwitcher current="management" />
        </header>

        {q.isError && !data ? (
          <div className="lmgmt__errwrap">
            <ErrorState
              message={(q.error as Error)?.message || "학습 기록을 불러오지 못했어요."}
              onRetry={() => q.refetch()}
            />
          </div>
        ) : !data ? (
          <div className="lmgmt__loading" aria-busy="true" aria-label="불러오는 중">
            <div className="skeleton lmgmt__sk-heading" />
            <div className="skeleton lmgmt__sk-card" />
            <div className="skeleton lmgmt__sk-chart" />
          </div>
        ) : (
          <>
            <h1 className="lmgmt__heading">{headline}</h1>

            {/* Today's summary — server-provided, HH:MM + combined learning count. */}
            <div className="lmgmt__summary">
              <div className="lmgmt__summary-col">
                <span className="lmgmt__summary-label">오늘 공부한 시간</span>
                <span className="lmgmt__summary-value">{fmtHHMM(data.today.study_seconds)}</span>
              </div>
              <div className="lmgmt__summary-divider" aria-hidden="true" />
              <div className="lmgmt__summary-col">
                <span className="lmgmt__summary-label">오늘의 학습</span>
                <span className="lmgmt__summary-value">{data.today.learning_count}</span>
              </div>
            </div>

            <div className="lmgmt__band" aria-hidden="true" />

            {empty ? (
              <>
                <h2 className="lmgmt__section-title">내 학습 기록</h2>
                <div className="lmgmt__history">
                  <div className="lmgmt__empty">
                    <p className="lmgmt__empty-title">학습 기록이 아직 없어요</p>
                    <p className="lmgmt__empty-desc">
                      첫 학습을 시작하고
                      <br />
                      당신의 기록을 만들어 보세요!
                    </p>
                    <Button
                      variant="primary"
                      className="lmgmt__cta"
                      onClick={startLearning}
                      aria-label="학습 시작하기, 맞춤 학습으로 이동"
                    >
                      학습 시작하기
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="lmgmt__section">
                  <h2 className="lmgmt__section-title">내 학습 기록</h2>
                  <PeriodDropdown
                    period={period}
                    open={periodOpen}
                    setOpen={setPeriodOpen}
                    onSelect={(p) => {
                      setPeriodOpen(false);
                      setPeriod(p);
                    }}
                  />
                </div>

                {chartStale ? (
                  <div className="lmgmt__chart lmgmt__chart--loading" aria-busy="true" />
                ) : (
                  <Chart data={data} />
                )}

                <div className="lmgmt__totals">
                  <div className="lmgmt__totals-col">
                    <span className="lmgmt__totals-label">학습한 문장 수</span>
                    <span className="lmgmt__totals-value">
                      {chartStale ? "–" : data.period_totals.conversation_sentence_count.toLocaleString()}
                    </span>
                  </div>
                  <div className="lmgmt__summary-divider" aria-hidden="true" />
                  <div className="lmgmt__totals-col">
                    <span className="lmgmt__totals-label">학습한 문제 수</span>
                    <span className="lmgmt__totals-value">
                      {chartStale ? "–" : data.period_totals.topik_question_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Bar chart of study duration per bucket; current bucket is orange. */
function Chart({ data }: { data: ManagementStats }) {
  const max = Math.max(1, ...data.buckets.map((b) => b.study_seconds));
  return (
    <div className="lmgmt__chart" role="img" aria-label="기간별 학습 시간">
      {data.buckets.map((b) => {
        const pct =
          b.study_seconds > 0 ? Math.max(8, (b.study_seconds / max) * 100) : b.is_current ? 3 : 0;
        return (
          <div key={b.key} className="lmgmt__bar-col">
            <div className="lmgmt__bar-track">
              <div
                className={`lmgmt__bar${b.is_current ? " lmgmt__bar--current" : ""}`}
                style={{ height: `${pct}%` }}
              >
                {b.is_current && b.study_seconds > 0 && (
                  <span className="lmgmt__bar-value">{fmtShort(b.study_seconds)}</span>
                )}
              </div>
            </div>
            <span className="lmgmt__bar-label">{b.label}</span>
            <span className="sr-only">{`${b.label}: ${fmtShort(b.study_seconds)}`}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact period selector anchored below its trigger. */
function PeriodDropdown({
  period,
  open,
  setOpen,
  onSelect,
}: {
  period: ManagementPeriod;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSelect: (p: ManagementPeriod) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const measure = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.right });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.history.pushState({ __lmp: true }, "");
    let pushed = true;
    const onPop = () => {
      pushed = false;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      if (pushed) window.history.back(); // drop the dummy entry on in-place close
    };
  }, [open, setOpen]);

  const label = PERIODS.find((p) => p.id === period)!.label;
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lmgmt__period-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="기간 선택"
        onClick={() => setOpen(!open)}
      >
        {label}
        <svg
          className={`lmgmt__period-chev${open ? " lmgmt__period-chev--up" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" stroke="#8a929a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="lsw__overlay" onClick={() => setOpen(false)}>
          <div
            className="lmgmt__period-menu"
            role="menu"
            aria-label="기간"
            style={pos ? { top: pos.top, left: pos.left } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {PERIODS.map((p, i) => (
              <div key={p.id} className="lsw__row">
                {i > 0 && <div className="lmgmt__period-divider" aria-hidden="true" />}
                <button
                  type="button"
                  role="menuitem"
                  aria-current={p.id === period ? "true" : undefined}
                  className={`lmgmt__period-option${p.id === period ? " lmgmt__period-option--active" : ""}`}
                  onClick={() => onSelect(p.id)}
                >
                  {p.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
