import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import { ConfirmDialog } from "../components/ui/Modal";
import { DetailHeader } from "../components/DetailHeader";
import { AskMascot } from "../components/lecture/AskMascot";
import { EmptyState, LoadingState } from "../components/ui/states";
import { AskAiSheet } from "../components/AskAiSheet";
import { QuestionCard } from "../components/lecture/QuestionCard";
import { learnApi, practiceApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { isSubscriptionRequired, useLeaveLockedLecture } from "../hooks/premiumLecture";
import { ApiError, errorMessage } from "../lib/http";
import type { Quiz } from "../lib/types";

/**
 * TOPIK practice for one lecture: COU-003's count picker (1464:21369), then
 * the question run — COU-017 (511:9629), wrong COU-018 (511:9962), last
 * COU-019 (511:10118).
 *
 * A wrong answer keeps the learner on the question (retry until right) and
 * the mascot offers to explain it: "헷갈린 부분 내가 알려줄게!" opens the
 * 물어보기 sheet already explaining that attempt (COU-020, 557:9221). Once the
 * last question is solved the bottom bar offers 다시 풀기 (from the first
 * question) and 완료. Leaving early asks first (511:9565).
 */
export function Practice() {
  const { t, language } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Quiz[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [count, setCount] = useState(5);
  const [locked, setLocked] = useState(false);
  const [idx, setIdx] = useState(0);
  // Bumped by 다시 풀기 so every card starts over unanswered.
  const [round, setRound] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrongAttempt, setWrongAttempt] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);

  // COU-018's nav carries the lesson name; the practice payload does not include
  // it, so it comes from the lecture the practice set belongs to.
  const lecture = useQuery({
    queryKey: ["lecture", lectureId, language],
    queryFn: () => learnApi.lecture(lectureId, language),
    enabled: !!lectureId,
    retry: (n, e) => !isSubscriptionRequired(e) && n < 2,
  });
  // A premium lecture's practice reached by a direct link: the server refuses
  // the lecture (402), so leave with the subscription notice, as the series
  // page's tap would have.
  useLeaveLockedLecture(isSubscriptionRequired(lecture.error));

  const current = items?.[idx];
  // The practice question on screen counts as study (streak + learning day +
  // the sun), recorded once per local day and silently.
  useRecordDisplayedItem("topik", current?.quiz_id);

  async function start(n: number) {
    setStarting(true);
    try {
      const res = await practiceApi.start(lectureId, n);
      setItems(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setLocked(true);
      else toast.error(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  function goTo(next: number) {
    setSolved(false);
    setWrongAttempt(null);
    setAskOpen(false);
    setIdx(next);
  }

  function restart() {
    setRound((r) => r + 1);
    goTo(0);
  }

  if (locked)
    return (
      <Screen title={t("study.reviewTitle")} back>
        <EmptyState emoji="👑" title={t("study.premiumOnly")} text={t("study.reviewDesc")} action={<Button onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>} />
      </Screen>
    );

  if (!items || !current)
    return (
      <Screen title={t("study.reviewTitle")} back>
        {starting ? (
          <LoadingState text={t("study.preparing")} />
        ) : (
          /* COU-003 (1464:21369) presents the count as a 333x417 modal over a
             blurred scrim, not as an inline 2x2 grid. */
          <div className="overlay overlay--center qcount__overlay">
            <div className="qcount" role="dialog" aria-modal="true" aria-labelledby="qcount-title">
              <button className="qcount__close" onClick={() => nav(-1)} aria-label={t("common.close")}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M1 1l14 14M15 1L1 15" stroke="#262c31" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <p className="qcount__eyebrow">{t("study.reviewPrompt")}</p>
              <h2 className="qcount__title" id="qcount-title">{t("study.howManyQuestions")}</h2>
              <div className="qcount__options" role="radiogroup" aria-labelledby="qcount-title">
                {[5, 10, 15, 20].map((n) => (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={count === n}
                    className={`qcount__opt ${count === n ? "is-on" : ""}`}
                    onClick={() => setCount(n)}
                  >
                    {t("study.questionCount", { n })}
                  </button>
                ))}
              </div>
              <button className="qcount__cta" onClick={() => start(count)}>{t("study.startNow")}</button>
            </div>
          </div>
        )}
      </Screen>
    );

  const last = idx === items.length - 1;

  return (
    <Screen
      className="screen--practice"
      header={
        <DetailHeader
          className="topnav--practice"
          title={lecture.data?.title ?? t("study.reviewTitle")}
          onBack={() => setQuitOpen(true)}
        />
      }
    >
      <div className="pqz-page">
        <span className="pqz-page__count">
          {t("study.practiceCount", { current: idx + 1, total: items.length })}
        </span>
        {/* 511:9971 — the 45px mascot above the progress rail; after a wrong
            answer its bubble offers the explanation (COU-018). */}
        {wrongAttempt && (
          <button className="pqz-page__bubble" onClick={() => setAskOpen(true)}>
            {t("courses.explainBubble")}
          </button>
        )}
        <button className="pqz-page__mascot" onClick={() => setAskOpen(true)} aria-label={t("courses.chatbotA11y")}>
          <AskMascot />
        </button>
        <div className="pqz-page__progress">
          {/* COU-016/019: the rail is full when the counter reads n/n, so it
              tracks the question on screen, not the ones already answered. */}
          <span style={{ width: `${((idx + 1) / items.length) * 100}%` }} />
        </div>

        <QuestionCard
          key={`${round}-${current.quiz_id}`}
          quiz={current}
          source="custom"
          onWrong={(r) => setWrongAttempt(r.attempt_id)}
          onSolved={() => setSolved(true)}
          onDone={() => (last ? nav(-1) : goTo(idx + 1))}
        />

        {last && solved && (
          <div className="spk-page__bar">
            <button className="spk-page__tile" onClick={restart}>
              {t("courses.retryQuiz")}
            </button>
            <button className="spk-page__tile spk-page__tile--done" onClick={() => nav(-1)}>
              {t("courses.finish")}
            </button>
          </div>
        )}

        <AskAiSheet
          key={wrongAttempt ?? current.quiz_id}
          open={askOpen}
          context={
            wrongAttempt
              ? { contextKind: "quiz_attempt", contextId: wrongAttempt, autoExplain: true, bubble: true }
              : { contextKind: "quiz", contextId: current.quiz_id, autoExplain: false, bubble: false }
          }
          onClose={() => setAskOpen(false)}
        />
      </div>

      <ConfirmDialog
        open={quitOpen}
        title={t("courses.practiceQuitTitle")}
        text={t("courses.practiceQuitText")}
        cancelLabel={t("courses.keepGoing")}
        confirmLabel={t("courses.stopHere")}
        onCancel={() => setQuitOpen(false)}
        onConfirm={() => nav(-1)}
      />
    </Screen>
  );
}
