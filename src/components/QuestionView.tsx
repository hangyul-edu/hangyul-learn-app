import { OptionCard } from "./ui/kit";
import { useTranslation } from "../i18n";
import { TextArea, TextField } from "./ui/Field";
import type { Quiz } from "../lib/types";

export interface AnswerValue {
  choiceKey?: string;
  blanks?: string[];
  text?: string;
}

const CIRCLE = ["①", "②", "③", "④", "⑤"];

export function isAnswered(quiz: Quiz, v: AnswerValue): boolean {
  const f = quiz.answer.format;
  if (f === "single_choice") return !!v.choiceKey;
  if (f === "short_answer") return (v.blanks ?? []).some((b) => b.trim().length > 0);
  return (v.text ?? "").trim().length > 0;
}

/** Body for POST /quizzes/{id}/attempt. */
export function quizAttemptBody(quiz: Quiz, v: AnswerValue): Record<string, unknown> {
  const f = quiz.answer.format;
  if (f === "single_choice") return { answer: v.choiceKey };
  if (f === "short_answer") return { blank_answers: (v.blanks ?? []).map((t) => ({ text: t.trim() })) };
  return { answer: (v.text ?? "").trim() };
}

/** Single string answer for exam batch submit (ExamAnswer.answer: str). */
export function examAnswerString(quiz: Quiz, v: AnswerValue): string {
  const f = quiz.answer.format;
  if (f === "single_choice") return v.choiceKey ?? "";
  if (f === "short_answer") return (v.blanks ?? []).map((b) => b.trim()).join(" / ");
  return (v.text ?? "").trim();
}

export function QuestionView({
  quiz,
  value,
  onChange,
  disabled,
}: {
  quiz: Quiz;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { material, answer } = quiz;
  return (
    <div className="stack" style={{ gap: 14 }}>
      {material?.html && (
        <div className="card card--flat" style={{ background: "var(--surface-2)", fontSize: 14, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: material.html }} />
      )}
      {material?.image_url && <img src={material.image_url} alt="" style={{ width: "100%", borderRadius: 14 }} />}
      {material?.audio?.url && (
        <audio controls src={material.audio.url} style={{ width: "100%" }} />
      )}

      <div className="card card--pad-lg">
        <div className="eyebrow" style={{ marginBottom: 8 }}>{t("session.questionLabel")}</div>
        <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.55 }}>{quiz.prompt}</div>
        {quiz.prompt_translation && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{quiz.prompt_translation}</div>}
      </div>

      {answer.format === "single_choice" &&
        answer.choices.map((c, i) => (
          <OptionCard
            key={c.key}
            selected={value.choiceKey === c.key}
            onClick={() => !disabled && onChange({ choiceKey: c.key })}
            emoji={CIRCLE[i]}
            title={c.text}
          />
        ))}

      {answer.format === "short_answer" &&
        (answer.blanks.length ? answer.blanks : [{ label: t("session.answerLabel") }]).map((b, i) => (
          <TextField
            key={i}
            label={b.label}
            placeholder={t("session.answerPlaceholder")}
            disabled={disabled}
            value={value.blanks?.[i] ?? ""}
            onChange={(e) => {
              const blanks = [...(value.blanks ?? [])];
              blanks[i] = e.target.value;
              onChange({ blanks });
            }}
          />
        ))}

      {answer.format === "free_response" && (
        <TextArea
          label={t("session.answerWrite")}
          placeholder={t("session.answerFree")}
          disabled={disabled}
          style={{ minHeight: 140 }}
          value={value.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}
      {quiz.hint && <div className="muted" style={{ fontSize: 12.5 }}>💡 {t("session.hint")}: {quiz.hint}</div>}
    </div>
  );
}
