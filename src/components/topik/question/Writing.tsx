import { countTopikChars } from "../../../lib/topikChars";
import { Passage, type FormatProps } from "./parts";

/** Writing — data response and opinion essay, with the character band. */
export function Writing({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  tone,
}: FormatProps) {
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
        {/* TAL-028 (1718:27421) — the counter lives in a band inside the
            field's own box, not on a separate row beneath it. */}
        <div
          className={`tq-writing__box ${over ? "is-over" : ""} ${
            tone === "incorrect" ? "is-wrong" : disabled ? "is-done" : ""
          }`}
        >
        <textarea
          className="tq-writing__area"
          placeholder={copy.answerPlaceholder}
          aria-label={copy.answerPlaceholder}
          aria-describedby="tq-writing-count"
          disabled={disabled}
          value={text}
          onChange={(e) => onChange({ text: e.target.value })}
        />
        {/* TAL-025/027 (data response) carry no counter; TAL-028/030 (opinion
            essay, 600~700자) do. The band follows the question's own limit. */}
        {max > 0 && (
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
        )}
        </div>
      </div>
    </>
  );
}
