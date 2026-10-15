import { useTranslation } from "../../../i18n";
import { Passage, type FormatProps } from "./parts";

export function FillBlanks({
  quiz,
  value,
  onChange,
  disabled,
  copy,
  tone,
}: FormatProps) {
  const { t } = useTranslation();
  const blanks = quiz.answer.blanks.length ? quiz.answer.blanks : [{ label: "" }];
  return (
    <>
      {quiz.material.html && <Passage html={quiz.material.html} />}
      <div className="tq-blanks">
        {blanks.map((b, i) => {
          const id = `tq-blank-${i}`;
          // TAL-022 tints the row and turns the disc orange once it holds an answer.
          const filled = (value.blanks?.[i] ?? "").trim().length > 0;
          // TAL-023 turns the rows red once the attempt came back incorrect.
          const rowState =
            tone === "incorrect" ? "is-wrong" : disabled ? "is-correct" : filled ? "is-filled" : "";
          return (
            <div className={`tq-blank ${rowState}`} key={i}>
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
                aria-label={b.label ? t("session.blankAnswerA11y", { label: b.label }) : copy.blankPlaceholder}
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
