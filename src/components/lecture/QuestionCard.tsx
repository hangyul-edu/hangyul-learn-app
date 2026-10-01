import { useEffect, useState } from "react";
import { useTranslation } from "../../i18n";
import { QuestionView, QuizAudio, isAnswered, quizAttemptBody } from "../QuestionView";
import type { AnswerValue } from "../QuestionView";
import { quizApi } from "../../api/endpoints";
import { useToast } from "../../hooks/toast";
import { errorMessage } from "../../lib/http";
import { sanitizeHtml } from "../../lib/sanitizeHtml";
import type { Quiz, QuizAttemptResult } from "../../lib/types";
import icAlert from "../../assets/brand/ic-24-alert.svg";
import icBookplus from "../../assets/brand/ic-24-bookplus.svg";
import icBookmarkOn from "../../assets/brand/ic-24-bookmark-filled.svg";

/**
 * The TOPIK question card — in a lecture (COU-011 442:9757, correct COU-012
 * 442:9868, wrong COU-013 442:9812) and in the standalone practice
 * (COU-017/018/019).
 *
 * A wrong answer does not move on: the pick turns red, 제출 stays off until a
 * different answer is chosen, and the learner retries until it is right.
 * Only a correct (or ungraded writing) answer shows 다음, which hands back
 * whether the first try was right.
 */
export function QuestionCard({
  quiz,
  source,
  nextLabel,
  onDone,
  onWrong,
  onSolved,
}: {
  quiz: Quiz;
  /** `lecture` attempts skip the daily goal, like every lecture-derived attempt. */
  source: "lecture" | "custom";
  nextLabel?: string;
  onDone: (firstTryCorrect: boolean) => void;
  /** A graded wrong answer, e.g. so the practice mascot can offer to explain it. */
  onWrong?: (result: QuizAttemptResult) => void;
  /** The question is answered (right, or a writing answer recorded); 다음 now shows. */
  onSolved?: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [value, setValue] = useState<AnswerValue>({});
  // The answer that was just marked wrong; submitting it again is pointless.
  const [rejected, setRejected] = useState<string | null>(null);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(!!quiz.bookmarked);

  useEffect(() => {
    setValue({});
    setRejected(null);
    setResult(null);
    setAttempts(0);
    setSaved(!!quiz.bookmarked);
  }, [quiz]);

  const answerKey = JSON.stringify(value);
  // The rejected pick stays red until another one is chosen; the title keeps
  // saying "다시 풀어보세요" until the question is answered right.
  const wrong = result?.correct === false && rejected === answerKey;
  const retrying = result?.correct === false;
  const finished = !!result && result.correct !== false;
  const ok = result?.correct === true;
  const state = ok ? "is-ok" : wrong ? "is-wrong" : "";
  const single = quiz.answer.format === "single_choice";

  async function submit() {
    setBusy(true);
    try {
      const r = await quizApi.attempt(quiz.quiz_id, { ...quizAttemptBody(quiz, value), source });
      setAttempts((n) => n + 1);
      setResult(r);
      if (r.correct === false) {
        setRejected(answerKey);
        onWrong?.(r);
      } else {
        onSolved?.();
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function change(next: AnswerValue) {
    if (finished) return;
    setValue(next);
  }

  async function toggleSave() {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      await (nextSaved ? quizApi.bookmark(quiz.quiz_id) : quizApi.unbookmark(quiz.quiz_id));
    } catch (e) {
      setSaved(!nextSaved);
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="pqz" role="group" aria-labelledby={`pqz-title-${quiz.quiz_id}`}>
      <div className="pqz__head">
        <h2 className={`pqz__title ${ok ? "is-ok" : retrying ? "is-wrong" : ""}`} id={`pqz-title-${quiz.quiz_id}`}>
          {retrying && <img className="pqz__alert" src={icAlert} alt="" aria-hidden="true" />}
          {ok && <span className="badge-check" aria-hidden="true" />}
          <span>{t(ok ? "study.correctTitle" : retrying ? "study.tryAgain" : "study.solvePrompt")}</span>
        </h2>
        <button
          className="pqz__save"
          aria-pressed={saved}
          aria-label={t(saved ? "study.unsaveQuestion" : "study.saveQuestion")}
          onClick={() => void toggleSave()}
        >
          <img src={saved ? icBookmarkOn : icBookplus} alt="" aria-hidden="true" />
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
          <ul className="pqz__opts" role="radiogroup" aria-labelledby={`pqz-title-${quiz.quiz_id}`}>
            {quiz.answer.choices.map((c, i) => {
              const on = value.choiceKey === c.key;
              return (
                <li key={c.key}>
                  <button
                    role="radio"
                    aria-checked={on}
                    disabled={finished}
                    className={`pqz__opt ${on ? "is-on" : ""} ${on ? state : ""}`}
                    onClick={() => change({ choiceKey: c.key })}
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
          <QuestionView quiz={quiz} value={value} onChange={change} disabled={finished} />
        )}
      </div>

      {finished && result.explanation && <p className="pqz__explain">{result.explanation}</p>}

      {!finished ? (
        <button
          className="pqz__cta"
          disabled={busy || !isAnswered(quiz, value) || wrong}
          onClick={() => void submit()}
        >
          {busy ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : t("study.submitShort")}
        </button>
      ) : (
        <button className="pqz__cta" onClick={() => onDone(attempts === 1 && ok)}>
          {nextLabel ?? t("study.cardNext")}
        </button>
      )}
    </div>
  );
}
