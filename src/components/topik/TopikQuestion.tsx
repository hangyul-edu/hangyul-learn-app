import { useEffect, useRef, useState } from "react";
import { quizApi } from "../../api/endpoints";
import { countTopikChars } from "../../lib/topikChars";
import type { TopikSessionCopy } from "../../lib/topikSessionCopy";
import type { Quiz, TopikQuestionFormat } from "../../lib/types";
import type { AnswerValue } from "../QuestionView";

/** The five learner-facing TOPIK formats plus a safe fallback. */
type Kind = TopikQuestionFormat | "unsupported";

const KNOWN: readonly TopikQuestionFormat[] = [
  "reading_multiple_choice",
  "listening_multiple_choice",
  "writing_fill_blanks",
  "writing_data_response",
  "writing_opinion_essay",
];

/** The question's discriminated type. Prefer the server-derived `question_type`;
 * if a payload predates it, fall back to deriving it from the answer/material
 * dimensions (mirrors the server classifier) so rendering never breaks. */
export function questionKind(quiz: Quiz): Kind {
  if (quiz.question_type && KNOWN.includes(quiz.question_type)) return quiz.question_type;
  const fmt = quiz.answer.format;
  if (fmt === "single_choice") {
    return quiz.material.kind === "audio" || quiz.topik_section === "listening"
      ? "listening_multiple_choice"
      : "reading_multiple_choice";
  }
  if (fmt === "short_answer") return "writing_fill_blanks";
  if (fmt === "free_response") {
    return quiz.material.kind === "table" ? "writing_data_response" : "writing_opinion_essay";
  }
  return "unsupported";
}

/** How many fill-in-the-blank fields the question renders. */
function blankCount(quiz: Quiz): number {
  return quiz.answer.blanks.length || 1;
}

/** Whether the current answer is a valid, submittable payload for its type:
 * MC needs one selection; fill-blanks needs every blank filled; writing must be
 * within [min, max] using the shared character-count rule. */
export function canSubmitTopik(quiz: Quiz, v: AnswerValue): boolean {
  const kind = questionKind(quiz);
  if (kind === "reading_multiple_choice" || kind === "listening_multiple_choice") {
    return !!v.choiceKey;
  }
  if (kind === "writing_fill_blanks") {
    const blanks = v.blanks ?? [];
    return Array.from({ length: blankCount(quiz) }).every(
      (_, i) => (blanks[i] ?? "").trim().length > 0,
    );
  }
  if (kind === "writing_data_response" || kind === "writing_opinion_essay") {
    const count = countTopikChars(v.text ?? "");
    const min = quiz.answer.min_length ?? 1;
    const max = quiz.answer.max_length ?? Number.POSITIVE_INFINITY;
    return count >= min && count <= max;
  }
  return false;
}

/* -------------------------------------------------------------------------- */

/** Per-option result markers for a multiple-choice question after submission:
 * the correct/selected option renders blue, previously-submitted wrong options
 * render red. Empty during answering (no result yet). */
export interface OptionResultState {
  /** The key to render blue: the selected option once the answer is correct. */
  correctKey?: string | null;
  /** Keys submitted and confirmed wrong for the current question (rendered red). */
  wrongKeys?: readonly string[];
}

export function TopikQuestion({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  optionResult,
  tone = "neutral",
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy: TopikSessionCopy;
  /** Result markers for MC options (blue correct / red wrong). Absent = none. */
  optionResult?: OptionResultState;
  /** Visual tone of the audio player — `incorrect` gives it the warm cream tint
   *  that matches the retry state; `neutral` otherwise. */
  tone?: "neutral" | "incorrect";
}) {
  const kind = questionKind(quiz);
  return (
    <div className="tq">
      {/* Gray instruction line = the server prompt (never hardcoded per type). */}
      <p className="tq__instruction">{quiz.prompt}</p>
      {quiz.prompt_translation && <p className="tq__instruction-sub">{quiz.prompt_translation}</p>}

      {kind === "reading_multiple_choice" && (
        <MultipleChoice quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} optionResult={optionResult} />
      )}
      {kind === "listening_multiple_choice" && (
        <MultipleChoice
          quiz={quiz}
          value={value}
          onChange={onChange}
          disabled={disabled}
          copy={copy}
          listening
          tone={tone}
          optionResult={optionResult}
        />
      )}
      {kind === "writing_fill_blanks" && (
        <FillBlanks quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} />
      )}
      {(kind === "writing_data_response" || kind === "writing_opinion_essay") && (
        <Writing quiz={quiz} value={value} onChange={onChange} disabled={disabled} copy={copy} />
      )}
      {kind === "unsupported" && <UnsupportedQuestion copy={copy} />}
    </div>
  );
}

/* ---- multiple choice (reading + listening) -------------------------------- */

function MultipleChoice({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  listening,
  tone = "neutral",
  optionResult,
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy?: TopikSessionCopy;
  listening?: boolean;
  tone?: "neutral" | "incorrect";
  optionResult?: OptionResultState;
}) {
  const correctKey = optionResult?.correctKey ?? null;
  const wrongKeys = optionResult?.wrongKeys ?? [];
  return (
    <>
      {listening && copy ? (
        <AudioPlayer quiz={quiz} copy={copy} tone={tone} />
      ) : (
        quiz.material.html && <Passage html={quiz.material.html} />
      )}
      {quiz.material.image_url && (
        <img className="tq__image" src={quiz.material.image_url} alt="" />
      )}
      <div className="tq-choices" role="radiogroup" aria-label={quiz.prompt}>
        {quiz.answer.choices.map((c) => {
          const selected = value.choiceKey === c.key;
          // Precedence correct > wrong > selected: the confirmed-correct option
          // is blue; any option submitted and confirmed wrong is coral (even while
          // it is still the current value, right after submitting it); a freshly
          // selected retry option that was never wrong shows the neutral orange
          // selected state — it never inherits the coral of a prior wrong attempt.
          const isCorrect = correctKey === c.key;
          const isWrong = !isCorrect && wrongKeys.includes(c.key);
          const isSelected = !isCorrect && !isWrong && selected;
          // The right-hand marker is a check on any chosen option — it always
          // represents the learner's selection. Colour carries the verdict (blue
          // correct / coral wrong / orange in-progress); a screen-reader label
          // states it too, so colour is never the only signal.
          const marked = isCorrect || isWrong || isSelected;
          const stateLabel = isCorrect
            ? (copy?.correct ?? "")
            : isWrong
              ? (copy?.incorrect ?? "")
              : "";
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`tq-choice ${isCorrect ? "is-correct" : isWrong ? "is-wrong" : isSelected ? "is-selected" : ""}`}
              onClick={() => !disabled && onChange({ choiceKey: c.key })}
              disabled={disabled}
            >
              <span className="tq-choice__num" aria-hidden="true">
                {c.key}
              </span>
              <span className="tq-choice__text">{c.text}</span>
              {stateLabel && <span className="sr-only">{stateLabel}</span>}
              {marked && (
                <span className="tq-choice__check" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ---- fill-in-the-blank ----------------------------------------------------- */

function FillBlanks({
  quiz,
  value,
  onChange,
  disabled,
  copy,
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy: TopikSessionCopy;
}) {
  const blanks = quiz.answer.blanks.length ? quiz.answer.blanks : [{ label: "" }];
  return (
    <>
      {quiz.material.html && <Passage html={quiz.material.html} />}
      <div className="tq-blanks">
        {blanks.map((b, i) => {
          const id = `tq-blank-${i}`;
          return (
            <div className="tq-blank" key={i}>
              {b.label && (
                <label className="tq-blank__label" htmlFor={id} aria-hidden={!b.label}>
                  {b.label}
                </label>
              )}
              <input
                id={id}
                className="tq-blank__input"
                type="text"
                placeholder={copy.blankPlaceholder}
                aria-label={b.label ? `${b.label} 답` : copy.blankPlaceholder}
                disabled={disabled}
                value={value.blanks?.[i] ?? ""}
                onChange={(e) => {
                  const next = [...(value.blanks ?? [])];
                  next[i] = e.target.value;
                  onChange({ blanks: next });
                }}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---- writing (data-response + opinion-essay) ------------------------------ */

function Writing({
  quiz,
  value,
  onChange,
  disabled,
  copy,
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
  copy: TopikSessionCopy;
}) {
  const text = value.text ?? "";
  const count = countTopikChars(text);
  const min = quiz.answer.min_length ?? 0;
  const max = quiz.answer.max_length ?? 0;
  const over = max > 0 && count > max;
  const under = count < min;
  return (
    <>
      {quiz.material.html && <Passage html={quiz.material.html} />}
      <div className="tq-writing">
        <textarea
          className="tq-writing__area"
          placeholder={copy.answerPlaceholder}
          aria-label={copy.answerPlaceholder}
          aria-describedby="tq-writing-count"
          disabled={disabled}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        <div className="tq-writing__foot">
          <span className="tq-writing__hint">
            {over ? copy.overMaxHint(max) : under && min > 0 ? copy.minLengthHint(min) : ""}
          </span>
          <span
            id="tq-writing-count"
            className={`tq-counter ${over ? "tq-counter--error" : ""}`}
            aria-live="polite"
          >
            {copy.charCount(count, max)}
          </span>
        </div>
      </div>
    </>
  );
}

/* ---- shared pieces --------------------------------------------------------- */

/** Server-authored passage / table / guiding-questions HTML (text elements
 * only — the server never returns media here). */
function Passage({ html }: { html: string }) {
  return <div className="tq-passage" dangerouslySetInnerHTML={{ __html: html }} />;
}

function UnsupportedQuestion({ copy }: { copy: TopikSessionCopy }) {
  return (
    <div className="tq-unsupported" role="alert">
      {copy.unsupported}
    </div>
  );
}

function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Listening audio: fetches a signed URL lazily on first play, exposes
 * play/pause + a track label + time, and surfaces a retryable error. Selection
 * state lives above this component, so playback never disturbs the answer. */
function AudioPlayer({
  quiz,
  copy,
  tone = "neutral",
}: {
  quiz: Quiz;
  copy: TopikSessionCopy;
  tone?: "neutral" | "incorrect";
}) {
  // Duration isn't in the list payload; it's learned from the audio endpoint or
  // the element's loadedmetadata event.
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(quiz.material.audio?.url ?? null);

  // Pause + release on unmount / question switch so audio never bleeds across items.
  useEffect(() => {
    return () => {
      elRef.current?.pause();
      elRef.current = null;
    };
  }, []);

  async function ensureEl(): Promise<HTMLAudioElement> {
    if (!urlRef.current) {
      const res = await quizApi.audio(quiz.quiz_id);
      urlRef.current = res.url;
      if (res.duration_ms) setDur(res.duration_ms / 1000);
    }
    if (!elRef.current) {
      const el = new Audio(urlRef.current);
      el.ontimeupdate = () => setPos(el.currentTime);
      el.onloadedmetadata = () => setDur(el.duration);
      el.onended = () => {
        setState("paused");
        setPos(0);
      };
      el.onerror = () => setState("error");
      elRef.current = el;
    }
    return elRef.current;
  }

  async function toggle() {
    try {
      if (state === "playing") {
        elRef.current?.pause();
        setState("paused");
        return;
      }
      setState("loading");
      const el = await ensureEl();
      await el.play();
      setState("playing");
    } catch {
      setState("error");
    }
  }

  const label =
    state === "loading" ? copy.audioLoading : state === "playing" ? copy.audioPause : copy.audioPlay;

  return (
    <div className={`tq-audio ${tone === "incorrect" ? "tq-audio--incorrect" : ""}`}>
      <button
        type="button"
        className={`tq-audio__play ${state === "playing" ? "is-playing" : ""}`}
        onClick={toggle}
        disabled={state === "loading"}
        aria-label={label}
      >
        {state === "loading" ? (
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2.5 }} />
        ) : state === "playing" ? (
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1.2" fill="#fff" />
            <rect x="14" y="5" width="4" height="14" rx="1.2" fill="#fff" />
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
          </svg>
        )}
      </button>
      <div className="tq-audio__meta">
        <span className="tq-audio__label">{copy.audioTrack}</span>
        <span className="tq-audio__time">
          {fmtTime(pos)} / {fmtTime(dur)}
        </span>
        {state === "error" && <span className="tq-audio__error">{copy.audioError}</span>}
      </div>
    </div>
  );
}
