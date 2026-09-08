import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation, type TranslationKey } from "../i18n";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { learnApi } from "../api/endpoints";
import { LearningSectionSwitcher } from "../components/LearningSectionSwitcher";
import { Button } from "../components/ui/kit";
import { ErrorState } from "../components/ui/states";
import type { ManagementBucket, ManagementPeriod, ManagementStats } from "../lib/types";

const PERIODS: { id: ManagementPeriod; label: TranslationKey }[] = [
  { id: "7d", label: "learningManagement.last7" },
  { id: "1m", label: "learningManagement.thisMonth" },
  { id: "3m", label: "learningManagement.last3m" },
  { id: "1y", label: "learningManagement.last1y" },
];

/** Seconds → "HH:MM" (summary card). */
function fmtHHMM(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
}
/** Seconds → compact "1h33m" / "33m" — unspaced, as HMA-002 labels its bar. */
function fmtShort(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

/**
 * X-axis label for one bar, derived here rather than taken from the response.
 *
 * The API used to send a generated Korean label ("월", "1주", "9월") that did not
 * vary with the app language, so rendering it left English users reading Korean
 * axis labels. That field is gone: the bucket's dates carry everything needed,
 * so every client formats its own — which also means switching language
 * re-renders the axis immediately, with no refetch.
 *
 * `Intl` reproduces both Figma frames exactly: weekday `short` gives 월…일
 * (HMA-002 KO 1:3636) and Mon…Sun (EN 784:50416); month `short` gives 9월 / Sep,
 * the Korean matching what the server used to send. Only the weekly label has no
 * Intl equivalent, so it goes through the catalog.
 */
function bucketLabel(
  bucket: ManagementBucket,
  period: ManagementPeriod,
  index: number,
  locale: string,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  // Parse at local midnight: a bare "YYYY-MM-DD" is parsed as UTC and would
  // shift to the previous day (and so the previous weekday) west of Greenwich.
  const date = new Date(`${bucket.start_date}T00:00:00`);
  // A malformed date has no formattable label; show the raw value rather than
  // an empty tick, so the axis still lines up with the bars.
  if (Number.isNaN(date.getTime())) return bucket.start_date;
  if (period === "7d") return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  // Buckets arrive chronologically, one per calendar week of the month.
  if (period === "1m") return t("learningManagement.weekLabel", { n: index + 1 });
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
}

const BROWSER_TZ =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;

export function LearningManagement() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const navigatingRef = useRef(false);
  const [period, setPeriod] = useState<ManagementPeriod>("7d");
  const [periodOpen, setPeriodOpen] = useState(false);
  // Selected chart bar, tagged with the period it belongs to so the selection
  // falls back to the current bucket whenever the period changes.
  const [sel, setSel] = useState<{ period: ManagementPeriod; key: string } | null>(null);

  const q = useQuery({
    queryKey: ["management", period],
    queryFn: () => learnApi.management(period, BROWSER_TZ),
    placeholderData: keepPreviousData,
  });
  const data = q.data;
  // keepPreviousData still holds the previous period while the new one loads —
  // treat that as stale so old buckets never render under the new label.
  const chartStale = !data || data.period !== period;

  // The bottom totals reflect the SELECTED bar only (not the period aggregate).
  // Default to the current bucket; a user selection (tagged with its period)
  // overrides until the period changes.
  const currentKey = data
    ? data.buckets.find((b) => b.is_current)?.key ?? data.buckets[data.buckets.length - 1]?.key
    : undefined;
  const selectedKey = sel && data && sel.period === data.period ? sel.key : currentKey;
  const selectedBucket = data?.buckets.find((b) => b.key === selectedKey);

  function startLearning() {
    if (navigatingRef.current) return; // guard rapid double taps
    navigatingRef.current = true;
    nav("/recommend");
  }

  const empty = !!data && !data.has_any_eligible_learning_record;
  const headline = t(empty ? "learningManagement.waiting" : "learningManagement.praise");

  return (
    // HMA-004 re-typesets the English headline at 20 where HMA-002 uses 18, so
    // the empty state needs its own hook rather than one blanket EN override.
    <div className={`screen lmgmt${empty ? " lmgmt--empty" : ""}`}>
      <div className="lmgmt__scroll">
        <header className="strk__header lmgmt__header">
          <button className="strk__back" onClick={() => nav("/home")} aria-label={t("common.back")}>
            {/* ic_B_topNav variant=back, exactly as HMA-002 exports it. The
                hand-drawn 26px chevron was 2px short and sat 1px right. */}
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
          <LearningSectionSwitcher current="management" />
        </header>

        {q.isError && !data ? (
          <div className="lmgmt__errwrap">
            <ErrorState
              message={(q.error as Error)?.message || t("learningManagement.loadError")}
              onRetry={() => q.refetch()}
            />
          </div>
        ) : !data ? (
          <div className="lmgmt__loading" aria-busy="true" aria-label={t("learningManagement.loading")}>
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
                <span className="lmgmt__summary-label">{t("learningManagement.todayTime")}</span>
                <span className="lmgmt__summary-value">{fmtHHMM(data.today.study_seconds)}</span>
              </div>
              <div className="lmgmt__summary-divider" aria-hidden="true" />
              <div className="lmgmt__summary-col">
                <span className="lmgmt__summary-label">{t("learningManagement.todayHeading")}</span>
                <span className="lmgmt__summary-value">{data.today.learning_count}</span>
              </div>
            </div>

            <div className="lmgmt__band" aria-hidden="true" />

            {empty ? (
              <>
                <h2 className="lmgmt__section-title">{t("learningManagement.title")}</h2>
                <div className="lmgmt__history">
                  <div className="lmgmt__empty">
                    <p className="lmgmt__empty-title">{t("learningManagement.emptyTitle")}</p>
                    <p className="lmgmt__empty-desc">
                      {t("learningManagement.emptyLine1")}
                      <br />
                      {t("learningManagement.emptyLine2")}
                    </p>
                    <Button
                      variant="primary"
                      className="lmgmt__cta"
                      onClick={startLearning}
                      aria-label={t("learningManagement.startLearningA11y")}
                    >
                      {t("learningManagement.startLearning")}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="lmgmt__section">
                  <h2 className="lmgmt__section-title">{t("learningManagement.title")}</h2>
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
                  <Chart
                    data={data}
                    selectedKey={selectedKey}
                    onSelect={(key) => setSel({ period: data.period, key })}
                  />
                )}

                <div className="lmgmt__totals">
                  <div className="lmgmt__totals-col">
                    <span className="lmgmt__totals-label">{t("learningManagement.sentences")}</span>
                    <span className="lmgmt__totals-value">
                      {chartStale || !selectedBucket
                        ? "–"
                        : t("learningManagement.countUnit", {
                            n: selectedBucket.conversation_sentence_count.toLocaleString(),
                          })}
                    </span>
                  </div>
                  <div className="lmgmt__summary-divider" aria-hidden="true" />
                  <div className="lmgmt__totals-col">
                    <span className="lmgmt__totals-label">{t("learningManagement.questions")}</span>
                    <span className="lmgmt__totals-value">
                      {chartStale || !selectedBucket
                        ? "–"
                        : t("learningManagement.countUnit", {
                            n: selectedBucket.topik_question_count.toLocaleString(),
                          })}
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

/**
 * Bar chart of study duration per bucket. Bars are selectable: the highlighted
 * (orange) bar shows its duration above it — the current bucket is selected by
 * default, and tapping any bar moves the highlight (and drives the totals below
 * the chart). Selection is owned by the parent so the totals can read it.
 */
function Chart({
  data,
  selectedKey,
  onSelect,
}: {
  data: ManagementStats;
  selectedKey: string | undefined;
  onSelect: (key: string) => void;
}) {
  const { t, language } = useTranslation();
  const locale = language === "ko" ? "ko-KR" : "en-US";
  const max = Math.max(1, ...data.buckets.map((b) => b.study_seconds));
  return (
    <div className="lmgmt__chart" role="group" aria-label={t("learningManagement.periodHeading")}>
      {data.buckets.map((b, i) => {
        const selected = b.key === selectedKey;
        const label = bucketLabel(b, data.period, i, locale, t);
        const pct =
          b.study_seconds > 0 ? Math.max(8, (b.study_seconds / max) * 100) : selected ? 3 : 0;
        return (
          <div key={b.key} className="lmgmt__bar-col">
            <button
              type="button"
              className="lmgmt__bar-track"
              aria-pressed={selected}
              aria-label={`${label} ${fmtShort(b.study_seconds)}`}
              onClick={() => onSelect(b.key)}
            >
              <div
                className={`lmgmt__bar${b.is_current ? " lmgmt__bar--current" : ""}${selected ? " lmgmt__bar--selected" : ""}`}
                style={{ height: `${pct}%` }}
              >
                {selected && <span className="lmgmt__bar-value">{fmtShort(b.study_seconds)}</span>}
              </div>
            </button>
            <span className="lmgmt__bar-label">{label}</span>
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
  const { t } = useTranslation();
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

  const label = t(PERIODS.find((p) => p.id === period)!.label);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lmgmt__period-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("learningManagement.periodAria")}
        onClick={() => setOpen(!open)}
      >
        <span className="lmgmt__period-label">{label}</span>
        {/* ic_16_arrow as `Group 1410118472` exports it: 20x20, #5A636A, 1.5px,
            square caps — already pointing down, so no base rotation. */}
        <svg
          className={`lmgmt__period-chev${open ? " lmgmt__period-chev--up" : ""}`}
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15.9375 6.5625L10.3125 12.1875L4.6875 6.5625"
            stroke="#5A636A"
            strokeWidth="1.5"
            strokeMiterlimit="10"
            strokeLinecap="square"
          />
        </svg>
      </button>
      {open && (
        <div className="lsw__overlay" onClick={() => setOpen(false)}>
          <div
            className="lmgmt__period-menu"
            role="menu"
            aria-label={t("learningManagement.period")}
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
                  {t(p.label)}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
