import { CheckIcon } from "../../brand/Glyphs";
import { AudioPlayer } from "./AudioPlayer";
import { Passage, type FormatProps, type OptionResultState } from "./parts";

/** Multiple choice — reading, or listening with the audio player. */
export function MultipleChoice({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  listening,
  tone = "neutral",
  optionResult,
}: Omit<FormatProps, "copy"> & {
  copy?: FormatProps["copy"];
  listening?: boolean;
  optionResult?: OptionResultState;
}) {
  const correctKey = optionResult?.correctKey ?? null;
  const wrongKeys = optionResult?.wrongKeys ?? [];
  return (
    <>
      {listening && copy ? (
        <AudioPlayer quiz={quiz} copy={copy} tone={tone} done={disabled && tone !== "incorrect"} />
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
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
