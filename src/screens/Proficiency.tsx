import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Async, SkeletonList } from "../components/ui/states";
import { proficiencyApi } from "../api/endpoints";
import { useTranslation } from "../i18n";
import { useToast } from "../hooks/toast";
import { errorMessage } from "../lib/http";
import type {
  Bilingual,
  ConversationProficiency,
  ProficiencyCapability,
  ProficiencyDecision,
  ProficiencySummary,
  TopikProficiency,
} from "../lib/types";

type Track = "conversation" | "topik";

/** Server copy in the member's language. */
function useBilingual() {
  const { language } = useTranslation();
  return (b?: Bilingual | null) => (b ? (language === "ko" ? b.ko : b.en) : "");
}

function useDate() {
  const { language } = useTranslation();
  return (iso: string) =>
    new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
}

/**
 * My proficiency: confirmed level / readiness, what the next level needs and
 * the next useful assessment. Everything shown is evidence from
 * personalized-learning assessments; completed items, lectures, points and
 * streaks never appear here.
 */
export function ProficiencyScreen() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const params = useParams();
  const track: Track = params.track === "topik" ? "topik" : "conversation";
  const q = useQuery({ queryKey: ["proficiency"], queryFn: proficiencyApi.me });

  return (
    <Screen title={t("proficiency.title")} back className="prof">
      <div className="prof__tabs" role="tablist" aria-label={t("proficiency.title")}>
        {(["conversation", "topik"] as const).map((tr) => (
          <button
            key={tr}
            role="tab"
            aria-selected={track === tr}
            className={`prof__tab ${track === tr ? "is-active" : ""}`}
            onClick={() => nav(`/proficiency/${tr}`, { replace: true })}
          >
            {tr === "conversation" ? t("proficiency.tabConversation") : t("proficiency.tabTopik")}
          </button>
        ))}
      </div>
      <Async
        loading={q.isLoading}
        error={q.error}
        data={q.data}
        onRetry={() => q.refetch()}
        skeleton={<SkeletonList rows={4} height={110} />}
      >
        {(d: ProficiencySummary) =>
          track === "topik" ? (
            <TopikPanel data={d.tracks[1]} decisionsApply={d.decisions_apply} />
          ) : (
            <ConversationPanel data={d.tracks[0]} decisionsApply={d.decisions_apply} />
          )
        }
      </Async>
    </Screen>
  );
}

function StatusCard({
  status,
  levelText,
  canDo,
  studyLine,
  extra,
}: {
  status: ConversationProficiency["status"];
  levelText: string | null;
  canDo?: string;
  studyLine?: string | null;
  extra?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className={`prof__status prof__status--${status}`} aria-label={t(`proficiency.status.${status}`)}>
      <span className="prof__badge">{t(`proficiency.status.${status}`)}</span>
      <div className="prof__level">{levelText ?? "—"}</div>
      <p className="prof__hint">{t(`proficiency.statusHint.${status}`)}</p>
      {canDo && (
        <div className="prof__cando">
          <span className="prof__cando-label">{t("proficiency.canDo")}</span>
          <p>{canDo}</p>
        </div>
      )}
      {extra}
      {studyLine && <p className="prof__study">{studyLine}</p>}
    </section>
  );
}

function useStartAssessment() {
  const nav = useNavigate();
  const toast = useToast();
  return useMutation({
    mutationFn: proficiencyApi.start,
    onSuccess: (s) => nav(`/proficiency/assess/${s.session_id}`, { state: { session: s } }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

function DecisionBox({ decision }: { decision: ProficiencyDecision | null }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const date = useDate();
  if (!decision) return null;
  return (
    <section className="prof__card prof__decision">
      <h3 className="prof__h3">{t("proficiency.lastDecision")}</h3>
      <p>{bl(decision.explanation)}</p>
      <p className="prof__meta">
        {date(decision.decided_at)} · {decision.policy_version}
        {!decision.applied && ["promotion", "readiness_confirmed", "provisional_placement"].includes(decision.kind)
          ? ` · ${t("proficiency.notApplied")}`
          : ""}
      </p>
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  return (
    <details className="prof__card prof__how">
      <summary className="prof__h3">{t("proficiency.howTitle")}</summary>
      <p>{t("proficiency.howBody")}</p>
      <p className="prof__meta">{t("proficiency.provisionalNotice")}</p>
    </details>
  );
}

/* --------------------------------------------------------- conversation */

function CapabilityRow({ cap }: { cap: ProficiencyCapability }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const date = useDate();
  const delayed = cap.delayed_confirmed
    ? t("proficiency.delayedDone")
    : cap.delayed_check_due
      ? t("proficiency.delayedDue")
      : cap.delayed_check_available_at
        ? t("proficiency.delayedAt", { date: date(cap.delayed_check_available_at) })
        : t("proficiency.delayedNone");
  return (
    <li className={`prof__cap prof__cap--${cap.status}`}>
      <div className="prof__cap-head">
        <span className="prof__cap-name">{bl(cap.label)}</span>
        <span className="prof__chip">{t(`proficiency.capStatus.${cap.status}`)}</span>
      </div>
      <p className="prof__cap-criteria">{bl(cap.success_criteria)}</p>
      <p className="prof__cap-evidence">
        {t("proficiency.capEvidence", {
          n: cap.independent_successes,
          req: cap.required_successes,
          s: cap.situations,
          sreq: cap.required_situations,
          d: cap.study_days,
          dreq: cap.required_study_days,
        })}
      </p>
      <p className="prof__cap-delayed">{delayed}</p>
      {cap.status === "needs_reconfirmation" && <p className="prof__cap-miss">{t("proficiency.recentMiss")}</p>}
    </li>
  );
}

function ConversationPanel({ data, decisionsApply }: { data: ConversationProficiency; decisionsApply: boolean }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const date = useDate();
  const nav = useNavigate();
  const start = useStartAssessment();
  const [level, setLevel] = useState<number>(Math.max(1, data.study_level ?? 1));
  const shownLevel = data.confirmed_level ?? data.provisional_level;
  const nl = data.next_level;
  const act = data.next_activity;
  const busy = start.isPending;

  return (
    <div className="prof__panel">
      <StatusCard
        status={data.status}
        levelText={shownLevel != null ? t("proficiency.levelLabel", { n: shownLevel }) : null}
        canDo={bl(data.confirmed_can_do)}
        studyLine={data.study_level != null ? t("proficiency.studyLevel", { n: data.study_level }) : null}
      />

      {data.active_session_id && (
        <button className="btn btn--primary btn--block" onClick={() => nav(`/proficiency/assess/${data.active_session_id}`)}>
          {t("proficiency.resume")}
        </button>
      )}

      <section className="prof__card prof__next">
        <h3 className="prof__h3">{t("proficiency.next")}</h3>
        <p>{bl(act.reason)}</p>
        {act.kind === "placement" && (
          <div className="prof__placement">
            <span className="prof__label">{t("proficiency.chooseLevel")}</span>
            <div className="prof__levels" role="radiogroup" aria-label={t("proficiency.chooseLevel")}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={level === n}
                  className={`prof__level-chip ${level === n ? "is-active" : ""}`}
                  onClick={() => setLevel(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="prof__meta">{t("proficiency.placementHint")}</p>
            <button
              className="btn btn--primary btn--block"
              disabled={busy}
              onClick={() => start.mutate({ track: "conversation", mode: "conv_placement", target_level: level })}
            >
              {t("proficiency.start.placement")}
            </button>
            <button
              className="btn btn--secondary btn--block"
              disabled={busy}
              onClick={() => start.mutate({ track: "conversation", mode: "conv_capability_check" })}
            >
              {t("proficiency.startLevel1")}
            </button>
          </div>
        )}
        {(act.kind === "capability_check" || act.kind === "delayed_check" || act.kind === "integrative") && (
          <button
            className="btn btn--primary btn--block"
            disabled={busy || (nl?.unseen_tasks_left ?? 0) === 0}
            onClick={() => start.mutate({ track: "conversation", mode: `conv_${act.kind}` })}
          >
            {t(`proficiency.start.${act.kind}`)}
          </button>
        )}
        {act.kind === "capability_check" && (
          <button
            className="btn btn--secondary btn--block"
            disabled={busy || (nl?.unseen_tasks_left ?? 0) === 0}
            onClick={() => start.mutate({ track: "conversation", mode: "conv_integrative" })}
          >
            {t("proficiency.start.integrative")}
          </button>
        )}
        {act.kind === "wait" && act.available_at && (
          <button className="btn btn--secondary btn--block" disabled>
            {t("proficiency.waitUntil", { date: date(act.available_at) })}
          </button>
        )}
        {act.kind === "unavailable" && <p className="prof__warn">{t("proficiency.unavailable")}</p>}
        {nl && nl.unseen_tasks_left === 0 && <p className="prof__warn">{t("proficiency.noTasksLeft")}</p>}
      </section>

      {nl && (
        <section className="prof__card">
          <h3 className="prof__h3">{t("proficiency.nextLevel", { n: nl.level })}</h3>
          <p className="prof__cando-next">{bl(nl.can_do)}</p>
          {nl.ready && (
            <p className="prof__ready" role="status">
              {decisionsApply ? t("proficiency.readyBanner") : t("proficiency.readyShadow")}
            </p>
          )}
          <div className="prof__meter" aria-label={t("proficiency.coverage", { confirmed: nl.coverage.confirmed, total: nl.coverage.total })}>
            <div className="prof__meter-head">
              <span>{t("proficiency.coverage", { confirmed: nl.coverage.confirmed, total: nl.coverage.total })}</span>
            </div>
            <div className="prof__bar">
              <div className="prof__bar-fill" style={{ width: `${nl.coverage.pct}%` }} />
            </div>
          </div>
          <div className="prof__meter">
            <div className="prof__meter-head">
              <span>{t("proficiency.checklist", { pct: Math.round(nl.checklist.pct) })}</span>
            </div>
            <div className="prof__bar prof__bar--soft">
              <div className="prof__bar-fill" style={{ width: `${nl.checklist.pct}%` }} />
            </div>
            <p className="prof__meta">{t("proficiency.checklistHint")}</p>
          </div>

          <h4 className="prof__h4">{t("proficiency.gatesTitle")}</h4>
          <ul className="prof__gates">
            {nl.gates.map((g) => (
              <li key={g.gate} className={g.passed ? "is-passed" : ""}>
                <span className="prof__gate-mark" aria-hidden="true">{g.passed ? "✓" : "·"}</span>
                <span>{bl(g.label)}</span>
              </li>
            ))}
            <li className={nl.integrative?.result === "passed" ? "is-passed" : ""}>
              <span className="prof__gate-mark" aria-hidden="true">{nl.integrative?.result === "passed" ? "✓" : "·"}</span>
              <span>
                {t("proficiency.integrative")}:{" "}
                {t(`proficiency.integrativeResult.${(nl.integrative?.result ?? "not_taken") as "passed"}`)}
              </span>
            </li>
          </ul>

          <h4 className="prof__h4">{t("proficiency.capabilitiesTitle")}</h4>
          <ul className="prof__caps">
            {nl.capabilities.map((c) => (
              <CapabilityRow key={c.capability_id} cap={c} />
            ))}
          </ul>
        </section>
      )}

      {data.at_maximum && <p className="prof__card">{t("proficiency.maintenance")}</p>}
      <DecisionBox decision={data.last_decision} />
      <HowItWorks />
    </div>
  );
}

/* ---------------------------------------------------------------- TOPIK */

const MOCK_MINUTES: Record<"I" | "II", number> = { I: 100, II: 180 };

function TopikPanel({ data }: { data: TopikProficiency; decisionsApply: boolean }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const nav = useNavigate();
  const start = useStartAssessment();
  const grade = data.confirmed_grade ?? data.provisional_grade;

  return (
    <div className="prof__panel">
      <StatusCard
        status={data.status}
        levelText={grade != null ? t("proficiency.gradeLabel", { n: grade }) : null}
        canDo={grade != null ? bl(data.grade_descriptors[String(grade)]) : undefined}
        studyLine={data.study_level != null ? t("proficiency.studyGrade", { n: data.study_level }) : null}
        extra={
          <>
            <p className="prof__basis">{t("proficiency.topik.basis")}</p>
            {data.target_grade != null && <p className="prof__meta">{t("proficiency.topik.targetGrade", { n: data.target_grade })}</p>}
          </>
        }
      />
      {data.active_session_id && (
        <button className="btn btn--primary btn--block" onClick={() => nav(`/proficiency/assess/${data.active_session_id}`)}>
          {t("proficiency.resume")}
        </button>
      )}
      {data.at_maximum && <p className="prof__card">{t("proficiency.topik.gradeMax")}</p>}

      {(["I", "II"] as const).map((lv) => {
        const r = data.readiness[lv];
        const avail = data.mock_availability?.[lv];
        const scores = Object.entries(r.latest_section_scores ?? {});
        const statusText =
          r.status === "provisional" || r.status === "confirmed"
            ? t(`proficiency.topik.readiness.${r.status}`, { n: r.grade ?? "" })
            : t(`proficiency.topik.readiness.${r.status as "unassessed"}`);
        return (
          <section key={lv} className="prof__card prof__exam">
            <div className="prof__exam-head">
              <h3 className="prof__h3">{t(`proficiency.topik.examLevel.${lv}`)}</h3>
              <span className="prof__chip">{statusText}</span>
            </div>
            {r.basis === "listening_reading_only" && <p className="prof__warn">{t("proficiency.topik.noGradeWithoutWriting")}</p>}
            {scores.length > 0 && (
              <>
                <h4 className="prof__h4">{t("proficiency.topik.sectionScores")}</h4>
                <ul className="prof__scores">
                  {scores.map(([section, score]) => (
                    <li key={section}>
                      <span>{t(`proficiency.topik.section.${section as "listening"}`)}</span>
                      <span>{score == null ? "—" : `${Math.round(score)}/100`}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {r.weak_sections.length > 0 && (
              <p className="prof__meta">
                {t("proficiency.topik.weak", {
                  sections: r.weak_sections.map((s) => t(`proficiency.topik.section.${s as "listening"}`)).join(", "),
                })}
              </p>
            )}
            {avail?.full_form ? (
              <>
                <p className="prof__meta">{t("proficiency.topik.fullForm", { minutes: MOCK_MINUTES[lv] })}</p>
                <button
                  className="btn btn--primary btn--block"
                  disabled={start.isPending}
                  onClick={() => start.mutate({ track: "topik", mode: "topik_mock", exam_level: lv })}
                >
                  {t("proficiency.topik.startMock", { level: `TOPIK ${lv}` })}
                </button>
              </>
            ) : avail?.diagnostic_form ? (
              <>
                <p className="prof__warn">{t("proficiency.topik.diagnosticForm")}</p>
                <button
                  className="btn btn--secondary btn--block"
                  disabled={start.isPending}
                  onClick={() => start.mutate({ track: "topik", mode: "topik_mock", exam_level: lv })}
                >
                  {t("proficiency.topik.startMock", { level: `TOPIK ${lv}` })}
                </button>
              </>
            ) : (
              <p className="prof__meta">{t("proficiency.topik.mockUnavailable")}</p>
            )}
          </section>
        );
      })}
      <p className="prof__meta prof__rule">{t("proficiency.topik.rule")}</p>
      <DecisionBox decision={data.last_decision} />
      <HowItWorks />
    </div>
  );
}
