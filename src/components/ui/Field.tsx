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
