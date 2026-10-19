import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { learnApi } from "../api/endpoints";
import { LearningSectionHeader } from "../components/LearningSectionSwitcher";
import { Button } from "../components/ui/kit";
import { ErrorState } from "../components/ui/states";
import { errorMessage } from "../lib/http";
import type { ManagementPeriod } from "../lib/types";
import { Chart } from "./learningManagement/Chart";
import { fmtHHMM } from "./learningManagement/format";
import { PeriodDropdown } from "./learningManagement/PeriodDropdown";

/** One figure of a summary row: its label and value. */
function Figure({ className, label, value, testId }: { className: string; label: string; value: string; testId?: string }) {
  return (
    <div className={`${className}-col`} data-testid={testId}>
      <span className={`${className}-label`}>{label}</span>
      <span className={`${className}-value`}>{value}</span>
    </div>
  );
}

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
    // Days are the member's local days in the device timezone the app syncs.
    queryFn: () => learnApi.management(period),
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

  const count = (n: number) => t("learningManagement.countUnit", { n: n.toLocaleString() });
  const empty = !!data && !data.has_any_eligible_learning_record;
  const headline = t(empty ? "learningManagement.waiting" : "learningManagement.praise");

  return (
    // HMA-004 re-typesets the English headline at 20 where HMA-002 uses 18, so
    // the empty state needs its own hook rather than one blanket EN override.
    <div className={`screen lmgmt${empty ? " lmgmt--empty" : ""}`}>
      <div className="lmgmt__scroll">
        <LearningSectionHeader current="management" className="lmgmt__header" />

        {q.isError && !data ? (
          <div className="lmgmt__errwrap">
            <ErrorState
              message={errorMessage(q.error)}
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

            {/* Today's summary — server-provided HH:MM, then the conversation
                and TOPIK counts side by side. They are independent metrics and
                are never summed into one "learning" total. */}
            <div className="lmgmt__summary">
              <Figure className="lmgmt__summary" label={t("learningManagement.todayTime")} value={fmtHHMM(data.today.study_seconds)} />
              <div className="lmgmt__summary-divider" aria-hidden="true" />
              <Figure
                className="lmgmt__summary"
                testId="lmgmt-today-sentences"
                label={t("learningManagement.todaySentences")}
                value={count(data.today.conversation_sentence_count)}
              />
              <div className="lmgmt__summary-divider" aria-hidden="true" />
              <Figure
                className="lmgmt__summary"
                testId="lmgmt-today-questions"
                label={t("learningManagement.todayQuestions")}
                value={count(data.today.topik_question_count)}
              />
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
                  <Figure
                    className="lmgmt__totals"
                    label={t("learningManagement.sentences")}
                    value={chartStale || !selectedBucket ? "–" : count(selectedBucket.conversation_sentence_count)}
                  />
                  <div className="lmgmt__summary-divider" aria-hidden="true" />
                  <Figure
                    className="lmgmt__totals"
                    label={t("learningManagement.questions")}
                    value={chartStale || !selectedBucket ? "–" : count(selectedBucket.topik_question_count)}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
