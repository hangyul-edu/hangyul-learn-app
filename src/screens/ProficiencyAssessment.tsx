import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Async, SkeletonList } from "../components/ui/states";
import { TopikQuestion } from "../components/topik/TopikQuestion";
import type { AnswerValue } from "../components/QuestionView";
import { proficiencyApi, quizApi } from "../api/endpoints";
import { useTranslation } from "../i18n";
import { useToast } from "../hooks/toast";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { ApiError, errorMessage } from "../lib/http";
import { activityToQuiz } from "../lib/studySession";
import { useTopikSessionCopy } from "../lib/topikSessionCopy";
import type {
  AssessmentSessionView,
  AssessmentTask,
  Bilingual,
  MockItem,
  ProficiencyCelebration,
  Quiz,
  StudyActivity,
} from "../lib/types";

const DIMENSIONS = ["task_fulfillment", "listening_interaction", "language", "coherence_fluency", "pronunciation"] as const;

function useBilingual() {
  const { language } = useTranslation();
  return (b?: Partial<Bilingual> | null) => (b ? ((language === "ko" ? b.ko : b.en) ?? "") : "");
}

/** The celebration for an applied promotion / readiness decision, if any. */
function celebrationFor(s: AssessmentSessionView): ProficiencyCelebration | null {
  const d = s.decision;
  if (!d || !d.applied || d.to_level == null || !["promotion", "readiness_confirmed"].includes(d.kind)) return null;
  const coverage = d.gates.find((g) => g.gate === "required_capabilities_confirmed")?.detail;
  return {
    track: s.track,
    from_level: d.from_level,
    to_level: d.to_level,
    reward_points: d.reward_points,
    capabilities_confirmed: coverage?.confirmed ?? 0,
    from: `/proficiency/${s.track}`,
  };
}

/** Plays a short-lived signed URL; returns a promise that settles when it ends. */
function playUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended = () => resolve();
    audio.onerror = () => resolve();
    void audio.play().catch(() => resolve());
  });
}

export function ProficiencyAssessment() {
  const { t } = useTranslation();
  const { sessionId = "" } = useParams();
  const location = useLocation();
  const initial = (location.state as { session?: AssessmentSessionView } | null)?.session;
  const q = useQuery({
    queryKey: ["proficiency-session", sessionId],
    queryFn: () => proficiencyApi.get(sessionId),
    initialData: initial,
  });
  const title = q.data ? t(`assessment.title.${q.data.mode as "conv_placement"}`) : "";
  return (
    <Screen title={title} back className="pasm">
      <Async loading={q.isLoading} error={q.error} data={q.data} onRetry={() => q.refetch()} skeleton={<SkeletonList rows={3} height={120} />}>
        {(s: AssessmentSessionView) => (s.track === "topik" ? <MockFlow session={s} /> : <ConversationFlow session={s} />)}
      </Async>
    </Screen>
  );
}

/* ------------------------------------------------------- conversation */

function ConversationFlow({ session }: { session: AssessmentSessionView }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const tasks = session.tasks ?? [];
  const [finished, setFinished] = useState<AssessmentSessionView | null>(session.status === "completed" ? session : null);
  const firstOpen = tasks.findIndex((x) => x.status === "awaiting_response");
  const [index, setIndex] = useState(firstOpen === -1 ? Math.max(0, tasks.length - 1) : firstOpen);
  const task = tasks[index];

  const setTask = (updated: AssessmentTask) =>
    qc.setQueryData<AssessmentSessionView>(["proficiency-session", session.session_id], (old) =>
      old ? { ...old, tasks: (old.tasks ?? []).map((x) => (x.task_id === updated.task_id ? updated : x)) } : old,
    );

  const complete = useMutation({
    mutationFn: () => proficiencyApi.complete(session.session_id),
    onSuccess: (s) => {
      setFinished(s);
      qc.invalidateQueries({ queryKey: ["proficiency"] });
      const celebration = celebrationFor(s);
      if (celebration) nav("/level-up", { replace: true, state: { celebration } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (finished) {
    const decision = finished.decision;
    return (
      <div className="pasm__done">
        <h2 className="pasm__h2">{t("assessment.done")}</h2>
        {decision && <p className="pasm__explain">{bl(decision.explanation)}</p>}
        <button className="btn btn--primary btn--block" onClick={() => nav("/proficiency/conversation", { replace: true })}>
          {t("assessment.backToProficiency")}
        </button>
      </div>
    );
  }
  if (!task) return null;
  const allDone = tasks.every((x) => x.status !== "awaiting_response");
  return (
    <div className="pasm__flow">
      <p className="pasm__progress">{t("assessment.taskOf", { i: index + 1, n: tasks.length })}</p>
      <TaskView key={task.task_id} sessionId={session.session_id} task={task} voiceRequired={!!session.voice_required} onTask={setTask} />
      {task.status !== "awaiting_response" &&
        (index < tasks.length - 1 ? (
          <button className="btn btn--primary btn--block" onClick={() => setIndex(index + 1)}>
            {t("assessment.nextTask")}
          </button>
        ) : (
          allDone && (
            <button className="btn btn--primary btn--block" disabled={complete.isPending} onClick={() => complete.mutate()}>
              {t("assessment.finish")}
            </button>
          )
        ))}
    </div>
  );
}

function TaskView({
  sessionId,
  task,
  voiceRequired,
  onTask,
}: {
  sessionId: string;
  task: AssessmentTask;
  voiceRequired: boolean;
  onTask: (t: AssessmentTask) => void;
}) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const toast = useToast();
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [heardNothing, setHeardNothing] = useState(false);
  const [confirmText, setConfirmText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micError, setMicError] = useState(false);
  const turn = task.answered_turns;
  const awaiting = task.status === "awaiting_response";
  const allTurnsAnswered = turn >= task.turn_count;
  const playedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (awaiting) void proficiencyApi.present(sessionId, task.task_id).then(onTask).catch(() => undefined);
    // Mark the task shown once, when it is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.task_id]);

  async function listen(material = false) {
    try {
      // The first hearing of a partner turn is the task itself; each later
      // one is a replay, recorded as support.
      if (!material && playedRef.current.has(turn)) {
        onTask(await proficiencyApi.support(sessionId, task.task_id, turn, "replay"));
      }
      const audio = await proficiencyApi.partnerAudio(sessionId, task.task_id, material ? { material: true } : { turn });
      if (!material) playedRef.current.add(turn);
      await playUrl(audio.url);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function showText() {
    setConfirmText(false);
    try {
      onTask(await proficiencyApi.support(sessionId, task.task_id, turn, "text"));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function send(answer: Parameters<typeof proficiencyApi.turn>[3]) {
    setBusy(true);
    setHeardNothing(false);
    try {
      onTask(await proficiencyApi.turn(sessionId, task.task_id, turn, answer));
      setText("");
    } catch (e) {
      if (e instanceof ApiError && e.code === "proficiency.voice_empty") setHeardNothing(true);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const recorder = useVoiceRecorder({
    onRecorded: (audio, take) => send({ audio, take }),
    onUnavailable: () => setMicError(true),
    maxDurationMs: task.kind === "explanation" || task.kind === "summary" ? 120_000 : 90_000,
  });

  async function finish() {
    setBusy(true);
    try {
      onTask(await proficiencyApi.finish(sessionId, task.task_id));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const replays = task.replays[String(turn)] ?? 0;
  return (
    <section className="pasm__task">
      <span className="pasm__kind">{t(`assessment.kind.${task.kind}`)}</span>
      <p className="pasm__scene">{bl(task.scene)}</p>
      <p className="pasm__goal">
        <b>{t("assessment.goal")}</b> {bl(task.goal)}
      </p>
      {task.background && (
        <div className="pasm__background">
          <span className="pasm__label">{t("assessment.background")}</span>
          <p>{task.background}</p>
        </div>
      )}
      {task.has_listening_material && awaiting && (
        <button className="btn btn--secondary btn--block" onClick={() => listen(true)}>
          {t("assessment.listenMaterial")}
        </button>
      )}

      {task.my_turns.length > 0 && (
        <ol className="pasm__turns">
          {task.my_turns.map((m) => (
            <li key={m.index}>
              {task.partner_text[String(m.index)] && <p className="pasm__partner">{task.partner_text[String(m.index)]}</p>}
              <p className="pasm__mine">
                <span className="pasm__label">{t("assessment.yourAnswer")}</span> {m.transcript}
              </p>
            </li>
          ))}
        </ol>
      )}

      {awaiting && !allTurnsAnswered && (
        <div className="pasm__turn">
          <p className="pasm__label">{t("assessment.partnerTurn", { i: turn + 1, n: task.turn_count })}</p>
          <div className="pasm__row">
            <button className="btn btn--secondary" onClick={() => listen(false)}>
              {playedRef.current.has(turn) ? t("assessment.replay", { n: replays, max: task.replay_allowance }) : t("assessment.play")}
            </button>
            {task.partner_text[String(turn)] ? null : confirmText ? (
              <button className="btn btn--ghost" onClick={showText}>
                {t("common.confirm")}
              </button>
            ) : (
              <button className="btn btn--ghost" onClick={() => setConfirmText(true)}>
                {t("assessment.showText")}
              </button>
            )}
          </div>
          {confirmText && <p className="pasm__warn">{t("assessment.showTextConfirm")}</p>}
          {task.partner_text[String(turn)] && <p className="pasm__partner">{task.partner_text[String(turn)]}</p>}
          {heardNothing && <p className="pasm__warn" role="status">{t("assessment.reRecord")}</p>}
          {micError && <p className="pasm__warn" role="alert">{t("assessment.mic")}</p>}

          {typing && !voiceRequired ? (
            <div className="pasm__type">
              <textarea
                className="pasm__textarea"
                value={text}
                placeholder={t("assessment.typePlaceholder")}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
              />
              <button className="btn btn--primary btn--block" disabled={busy || !text.trim()} onClick={() => send({ text })}>
                {busy ? t("assessment.sending") : t("assessment.send")}
              </button>
            </div>
          ) : (
            <button
              className={`btn btn--primary btn--block pasm__record ${recorder.recording ? "is-recording" : ""}`}
              disabled={busy}
              onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            >
              {busy ? t("assessment.sending") : recorder.recording ? t("assessment.stop") : t("assessment.record")}
            </button>
          )}
          {!voiceRequired && (
            <button className="btn btn--ghost btn--block" onClick={() => setTyping(!typing)}>
              {typing ? t("assessment.voiceInstead") : t("assessment.typeInstead")}
            </button>
          )}
        </div>
      )}

      {awaiting && allTurnsAnswered && (
        <button className="btn btn--primary btn--block" disabled={busy} onClick={finish}>
          {busy ? t("assessment.scoring") : t("assessment.finishTask")}
        </button>
      )}

      {!awaiting && <TaskResult task={task} />}
    </section>
  );
}

function TaskResult({ task }: { task: AssessmentTask }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  if (task.status === "pending") return <p className="pasm__note">{t("assessment.pending")}</p>;
  if (task.status === "not_assessable") return <p className="pasm__note">{t("assessment.notAssessable")}</p>;
  const r = task.result;
  if (!r) return null;
  return (
    <div className="pasm__result">
      <ul className="pasm__dims">
        {DIMENSIONS.map((d) => {
          const score = r.dimension_scores[d];
          return (
            <li key={d}>
              <span className="pasm__dim-name">{t(`assessment.dimension.${d}`)}</span>
              {score == null ? (
                <span className="pasm__dim-na">{t("assessment.notApplicable")}</span>
              ) : (
                <span className="pasm__dim-score" aria-label={`${score}/4`}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <i key={i} className={i < score ? "is-on" : ""} />
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {bl(r.feedback) && (
        <div className="pasm__feedback">
          <span className="pasm__label">{t("assessment.feedback")}</span>
          <p>{bl(r.feedback)}</p>
        </div>
      )}
      <p className={`pasm__evidence ${r.counts_as_evidence ? "is-counted" : ""}`}>
        {r.counts_as_evidence ? t("assessment.counted") : t("assessment.notCounted")}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------- TOPIK mock */

function itemQuiz(item: MockItem, level: number): Quiz {
  return activityToQuiz(
    { activity_id: `mock:${item.position}`, quiz_id: item.quiz_id ?? undefined, content: item.payload, reveal: null } as unknown as StudyActivity,
    level,
  ) as unknown as Quiz;
}

function encodeAnswer(quiz: Quiz, v: AnswerValue): string {
  if (quiz.answer.format === "single_choice") return v.choiceKey ?? "";
  if (quiz.answer.format === "short_answer") {
    return JSON.stringify(Object.fromEntries(quiz.answer.blanks.map((b, i) => [b.label, (v.blanks ?? [])[i] ?? ""])));
  }
  return v.text ?? "";
}

function decodeAnswer(quiz: Quiz, answer: string | null): AnswerValue {
  if (!answer) return {};
  if (quiz.answer.format === "single_choice") return { choiceKey: answer };
  if (quiz.answer.format === "short_answer") {
    try {
      const map = JSON.parse(answer) as Record<string, string>;
      return { blanks: quiz.answer.blanks.map((b) => map[b.label] ?? "") };
    } catch {
      return {};
    }
  }
  return { text: answer };
}

function MockFlow({ session }: { session: AssessmentSessionView }) {
  const { t } = useTranslation();
  const bl = useBilingual();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const copy = useTopikSessionCopy();
  const items = useMemo(() => session.items ?? [], [session.items]);
  const level = session.exam_level === "I" ? 1 : 3;
  const [index, setIndex] = useState(() => Math.max(0, items.findIndex((i) => !i.answered)));
  const [values, setValues] = useState<Record<number, AnswerValue>>(() =>
    Object.fromEntries(items.map((i) => [i.position, decodeAnswer(itemQuiz(i, level), i.answer)])),
  );
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const submit = useMutation({
    mutationFn: () => proficiencyApi.complete(session.session_id),
    onSuccess: (s) => {
      qc.setQueryData(["proficiency-session", session.session_id], s);
      qc.invalidateQueries({ queryKey: ["proficiency"] });
      const celebration = celebrationFor(s);
      if (celebration) nav("/level-up", { replace: true, state: { celebration } });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (session.status === "completed") {
    const result = (session.result ?? {}) as {
      section_scores?: Record<string, number | null>;
      total?: number | null;
      grade_band?: number | null;
      form_complete?: boolean;
    };
    const max = (session.sections ?? []).reduce((acc, s) => acc + s.max_score, 0);
    return (
      <div className="pasm__done">
        <h2 className="pasm__h2">{t("assessment.done")}</h2>
        {!result.form_complete && <p className="pasm__warn">{t("assessment.diagnosticNotice")}</p>}
        <ul className="prof__scores">
          {Object.entries(result.section_scores ?? {}).map(([s, v]) => (
            <li key={s}>
              <span>{t(`proficiency.topik.section.${s as "listening"}`)}</span>
              <span>{v == null ? "—" : `${Math.round(v)}/100`}</span>
            </li>
          ))}
        </ul>
        {result.total != null && (
          <p className="pasm__total">
            {t("assessment.total", { score: Math.round(result.total), max })} ·{" "}
            {result.grade_band != null ? t("assessment.gradeBand", { n: result.grade_band }) : t("assessment.belowGrade")}
          </p>
        )}
        <p className="prof__basis">{t("proficiency.topik.basis")}</p>
        {session.decision && <p className="pasm__explain">{bl(session.decision.explanation)}</p>}
        <button className="btn btn--primary btn--block" onClick={() => nav("/proficiency/topik", { replace: true })}>
          {t("assessment.backToProficiency")}
        </button>
      </div>
    );
  }

  const item = items[index];
  if (!item) return null;
  const quiz = itemQuiz(item, level);
  const value = values[item.position] ?? {};
  const answeredCount = items.filter((i) => i.answered || values[i.position] && encodeAnswer(itemQuiz(i, level), values[i.position])).length;
  const minutesLeft = session.deadline_at ? Math.max(0, Math.round((new Date(session.deadline_at).getTime() - now) / 60_000)) : null;

  async function save(v: AnswerValue) {
    setValues((old) => ({ ...old, [item.position]: v }));
    const encoded = encodeAnswer(quiz, v);
    if (!encoded) return;
    try {
      await proficiencyApi.answer(session.session_id, item.position, encoded);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="pasm__flow">
      <div className="pasm__mockbar">
        <span>{t(`proficiency.topik.section.${item.section}`)}</span>
        <span>{t("assessment.answered", { n: answeredCount, total: items.length })}</span>
        {minutesLeft != null && <span>{t("assessment.timeLeft", { m: minutesLeft })}</span>}
      </div>
      {session.form_complete === false && <p className="pasm__warn">{t("assessment.diagnosticNotice")}</p>}
      {item.section === "listening" && item.quiz_id && <ListeningButton quizId={item.quiz_id} />}
      <TopikQuestion quiz={quiz} value={value} copy={copy} onChange={(v) => void save(v)} />
      <div className="pasm__row pasm__nav">
        <button className="btn btn--secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ‹
        </button>
        <span className="pasm__progress">
          {index + 1}/{items.length}
        </span>
        <button className="btn btn--secondary" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)}>
          ›
        </button>
      </div>
      {confirmSubmit ? (
        <>
          <p className="pasm__warn">{t("assessment.submitConfirm")}</p>
          <button className="btn btn--primary btn--block" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {t("common.confirm")}
          </button>
        </>
      ) : (
        <button className="btn btn--primary btn--block" onClick={() => setConfirmSubmit(true)}>
          {t("assessment.submitMock")}
        </button>
      )}
    </div>
  );
}

function ListeningButton({ quizId }: { quizId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <button
      className="btn btn--secondary btn--block"
      onClick={async () => {
        try {
          const audio = await quizApi.audio(quizId);
          await playUrl(audio.url);
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      {t("assessment.play")}
    </button>
  );
}
