import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../components/layout/Screen";
import { Button } from "../components/ui/kit";
import icAlert from "../assets/brand/ic-24-alert.svg";
import icBookplus from "../assets/brand/ic-24-bookplus.svg";
import { CharacterArt } from "../components/brand/ProfileAssets";
import { EmptyState, LoadingState } from "../components/ui/states";
import { QuestionView, QuizAudio, isAnswered, quizAttemptBody } from "../components/QuestionView";
import type { AnswerValue } from "../components/QuestionView";
import { learnApi, practiceApi, quizApi } from "../api/endpoints";
import { useToast } from "../hooks/toast";
import { useRecordDisplayedItem } from "../hooks/learningActivity";
import { ApiError, errorMessage } from "../lib/http";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import type { Quiz, QuizAttemptResult } from "../lib/types";

export function Practice() {
  const { t } = useTranslation();
  const { lectureId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Quiz[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [count, setCount] = useState(5);
  const [locked, setLocked] = useState(false);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState<AnswerValue>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [correct, setCorrect] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // COU-018's nav carries the lesson name; the practice payload does not include
  // it, so it comes from the lecture the practice set belongs to.
  const lecture = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: () => learnApi.lecture(lectureId),
    enabled: !!lectureId,
  });

  const current = items?.[idx];
  // The bookmark glyph reflects the question being shown, so it re-seeds from
  // the server's flag whenever the card advances.
  useEffect(() => setSaved(!!current?.bookmarked), [current]);
  // The practice question on screen counts as study (streak + learning day +
  // the sun), recorded once per UTC day and silently. `current` is undefined
  // before the set starts and on the completion screen, so neither records.
  useRecordDisplayedItem("topik", current?.quiz_id);

  function onChoose(key: string) {
    setValue({ choiceKey: key });
  }

  async function toggleSave(quiz: Quiz) {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      await (nextSaved ? quizApi.bookmark(quiz.quiz_id) : quizApi.unbookmark(quiz.quiz_id));
    } catch (e) {
      setSaved(!nextSaved);
      toast.error(errorMessage(e));
    }
  }

  async function start(count: number) {
    setStarting(true);
    try {
      const res = await practiceApi.start(lectureId, count);
      setItems(res.items);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) setLocked(true);
      else toast.error(errorMessage(e));
    } finally {
      setStarting(false);
    }
  }

  async function submit(quiz: Quiz) {
    setBusy(true);
    try {
      const r = await quizApi.attempt(quiz.quiz_id, quizAttemptBody(quiz, value));
      setResult(r);
      if (r.correct) setCorrect((c) => c + 1);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    setResult(null);
    setValue({});
    setIdx((i) => i + 1);
  }

  if (locked)
    return (
      <Screen title={t("study.reviewTitle")} back>
        <EmptyState emoji="👑" title={t("study.premiumOnly")} text={t("study.reviewDesc")} action={<Button onClick={() => nav("/subscription")}>{t("study.upgrade")}</Button>} />
      </Screen>
    );

  if (!items)
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

  if (idx >= items.length)
    return (
      <Screen title={t("study.reviewCompleteShort")} back>
        <div className="state">
          <div className="state__emoji">🎉</div>
          <div className="state__title">{t("study.reviewComplete")}</div>
          <div className="big-num" style={{ fontSize: 40, color: "var(--brand-600)" }}>{correct} / {items.length}</div>
          <div className="muted">{t("study.answer")}</div>
          <Button style={{ marginTop: 10 }} onClick={() => nav(-1)}>{t("study.goBack")}</Button>
        </div>
      </Screen>
    );

  const quiz = items[idx];
  const graded = !!result;
  const wrong = graded && result.correct === false;
  const ok = graded && result.correct === true;
  const single = quiz.answer.format === "single_choice";
  const state = ok ? "is-ok" : wrong ? "is-wrong" : "";

  /* COU-011 (442:9757) and its incorrect variant COU-013 (442:9812): a 333x457
     white card on a blurred scrim. The 289-wide column runs title -> rubric ->
     stem -> a 190-tall answer block -> the 116x42 제출. */
  return (
    <Screen title={lecture.data?.title ?? t("study.reviewTitle")} back>
      <div className="pqz-page">
        <span className="pqz-page__count">
          {t("study.practiceCount", { current: idx + 1, total: items.length })}
        </span>
        {/* 511:9971 — the 45px mascot sits above the progress rail. */}
        <span className="pqz-page__mascot" aria-hidden="true">
          <CharacterArt variant="AVATAR_01" fill="100%" />
        </span>
        <div className="pqz-page__progress">
          {/* COU-016/019: the rail is full when the counter reads n/n, so it
              tracks the question on screen, not the ones already answered. */}
          <span style={{ width: `${((idx + 1) / items.length) * 100}%` }} />
        </div>
        <div className="pqz" role="group" aria-labelledby="pqz-title">
          <div className="pqz__head">
            <h2 className={`pqz__title ${state}`} id="pqz-title">
              {wrong && <img className="pqz__alert" src={icAlert} alt="" aria-hidden="true" />}
              {ok && <span className="badge-check" aria-hidden="true" />}
              <span>{t(ok ? "study.correctTitle" : wrong ? "study.tryAgain" : "study.solvePrompt")}</span>
            </h2>
            <button
              className="pqz__save"
              aria-pressed={saved}
              aria-label={t(saved ? "study.unsaveQuestion" : "study.saveQuestion")}
              onClick={() => toggleSave(quiz)}
            >
              <img src={icBookplus} alt="" aria-hidden="true" />
            </button>
          </div>

          {quiz.material?.html && (
            <div className="pqz__material" dangerouslySetInnerHTML={{ __html: sanitizeHtml(quiz.material.html) }} />
          )}
          {quiz.material?.image_url && <img className="pqz__material-img" src={quiz.material.image_url} alt="" />}
          {/* The payload only says a clip exists; the signed URL is fetched on play. */}
          {quiz.material?.audio && <QuizAudio key={quiz.quiz_id} quizId={quiz.quiz_id} />}

          <p className="pqz__stem">{quiz.prompt}</p>
          {quiz.prompt_translation && <p className="pqz__trans">{quiz.prompt_translation}</p>}

          <div className="pqz__body">
            {single ? (
              <ul className="pqz__opts" role="radiogroup" aria-labelledby="pqz-title">
                {quiz.answer.choices.map((c, i) => {
                  const on = value.choiceKey === c.key;
                  return (
                    <li key={c.key}>
                      <button
                        role="radio"
                        aria-checked={on}
                        disabled={graded}
                        className={`pqz__opt ${on ? "is-on" : ""} ${on ? state : ""}`}
                        onClick={() => onChoose(c.key)}
                      >
                        <span className="pqz__num">{i + 1}</span>
                        <span className="pqz__label">{c.text}</span>
                        {on && <span className="pqz__check" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <QuestionView quiz={quiz} value={value} onChange={setValue} disabled={graded} />
            )}
          </div>

          {graded && result.explanation && <p className="pqz__explain">{result.explanation}</p>}

          {!graded ? (
            <button
              className="pqz__cta"
              disabled={busy || !isAnswered(quiz, value)}
              onClick={() => submit(quiz)}
            >
              {busy ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : t("study.submitShort")}
            </button>
          ) : (
            <button className="pqz__cta" onClick={next}>
              {t(idx + 1 < items.length ? "study.cardNext" : "study.seeResults")}
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}
