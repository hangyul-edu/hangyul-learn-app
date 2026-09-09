import { useTranslation } from "../../i18n";
import type { Sentence } from "../../lib/types";

/** A conversation item is a fill-in-the-blank when it ships a `display_text`
 * with a blank and structured blank metadata. */
export function hasBlank(sentence: Sentence): boolean {
  return (
    !!sentence.display_text &&
    sentence.display_text.includes("___") &&
    (sentence.blanks?.length ?? 0) > 0
  );
}

/** Renders `display_text` as one inline sentence: prefix text, the mint blank
 * (a revealed-hint chip in voice mode, or an inline text input in keyboard
 * mode), then suffix text. Falls back to the full sentence when there is no
 * blank. Never renders the answer. */
export function FillSentence({
  sentence,
  keyboard,
  typed,
  onTyped,
  revealed,
  onSubmit,
  submitting,
  composingRef,
}: {
  sentence: Sentence;
  keyboard: boolean;
  typed: string;
  onTyped: (value: string) => void;
  revealed: string;
  onSubmit: () => void;
  submitting: boolean;
  composingRef: React.MutableRefObject<boolean>;
}) {
  const { t } = useTranslation();
  if (!hasBlank(sentence)) {
    return <div className="sess__sentence">{sentence.korean}</div>;
  }
  const parts = (sentence.display_text ?? "").split("___");
  const widthEm = sentence.blanks?.[0]?.display_width_em ?? 6;
  return (
    <div className="sess__sentence sess__sentence--fill">
      {parts.map((part, index) => (
        <span key={index}>
          {part}
          {index < parts.length - 1 &&
            (keyboard ? (
              <span className="sess__blank sess__blank--edit">
                {/* The revealed hint is the input's placeholder — it shows the
                    partial answer while empty and is replaced the moment the
                    user types (not a separate element beside the input). */}
                <input
                  className="sess__blank-input"
                  style={{ width: `${widthEm}em` }}
                  value={typed}
                  placeholder={revealed}
                  onChange={(event) => onTyped(event.target.value)}
                  onCompositionStart={() => (composingRef.current = true)}
                  onCompositionEnd={() => (composingRef.current = false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !composingRef.current) {
                      event.preventDefault();
                      onSubmit();
                    }
                  }}
                  disabled={submitting}
                  autoFocus
                  lang="ko"
                  enterKeyHint="go"
                  aria-label={t("session.blankWord")}
                />
              </span>
            ) : (
              <span
                className="sess__blank"
                style={{ minWidth: `${widthEm}em` }}
                aria-label={
                  revealed ? t("session.blankHint", { hint: revealed }) : t("session.blank")
                }
              >
                {revealed || " "}
              </span>
            ))}
        </span>
      ))}
    </div>
  );
}
