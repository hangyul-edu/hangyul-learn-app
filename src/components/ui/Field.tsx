import { useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import type { InputHTMLAttributes, ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="field">
      {label && <label className="field__label">{label}</label>}
      {children}
      {error ? (
        <span className="field__error">⚠ {error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  right,
  className = "",
  ...rest
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  right?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      {right ? (
        <div className="input-affix">
          <input className={`input ${error ? "input--invalid" : ""} ${className}`} {...rest} />
          {right}
        </div>
      ) : (
        <input className={`input ${error ? "input--invalid" : ""} ${className}`} {...rest} />
      )}
    </Field>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  ...rest
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
} & InputHTMLAttributes<HTMLInputElement>) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <TextField
      label={label}
      hint={hint}
      error={error}
      type={show ? "text" : "password"}
      right={
        <button type="button" className="input-affix__btn" onClick={() => setShow((s) => !s)}>
          {show ? t("ui.hide") : t("ui.show")}
        </button>
      }
      {...rest}
    />
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...rest
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
} & InputHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea className={`input ${error ? "input--invalid" : ""}`} {...rest} />
    </Field>
  );
}

/** 6-digit verification code input. */
export function PinInput({
  length = 6,
  value,
  onChange,
}: {
  length?: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");
  function setAt(i: number, ch: string) {
    const digits = ch.replace(/\D/g, "");
    if (!digits) return;
    const next = (value.slice(0, i) + digits + value.slice(i + digits.length)).slice(0, length);
    onChange(next);
    const focusTo = Math.min(i + digits.length, length - 1);
    refs.current[focusTo]?.focus();
  }
  return (
    <div className="pin">
      {chars.map((c, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className="pin__box"
          inputMode="numeric"
          maxLength={length}
          value={c}
          onChange={(e) => setAt(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (t) {
              onChange(t);
              refs.current[Math.min(t.length, length - 1)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
