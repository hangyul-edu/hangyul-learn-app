import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import { Spinner } from "./ui/Spinner";

/**
 * Second-step withdrawal gate: current-password confirmation. Opened only after
 * the user taps 탈퇴 in the first warning modal — no API runs on open or on
 * typing. The password lives only in this component's local state (never global,
 * persisted, or logged) and is submitted to the server, which verifies it and
 * performs the atomic withdrawal (`deleteAccount(password)`). The password is
 * never checked on the client beyond a non-empty guard.
 *
 * Backdrop is not a dismiss target (security-sensitive); 취소 / Escape close it,
 * both disabled while the irreversible request is in flight. Focus is trapped
 * and restored to the opener on close.
 */
export function WithdrawPasswordModal({
  open,
  loading,
  error,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  /** Server-reported error (user-safe copy) for the last submit, or null. */
  error: string | null;
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [emptyErr, setEmptyErr] = useState(false);
  const [dirty, setDirty] = useState(false); // typed since the last submit → hide server error
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset secure state whenever the modal (re)opens; clear on close.
  useEffect(() => {
    setPassword("");
    setEmptyErr(false);
    setDirty(false);
  }, [open]);

  // The field takes focus once the dialog is presented.
  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: loading ? undefined : onCancel,
    initialFocus: inputRef,
    focusDelayMs: 50,
    focusables: "input, button:not([disabled])",
  });

  if (!open) return null;

  function submit() {
    if (loading) return;
    if (!password.trim()) {
      // Whitespace-only counts as empty; no API call.
      setEmptyErr(true);
      inputRef.current?.focus();
      return;
    }
    setDirty(false);
    onSubmit(password);
  }

  const shownError = emptyErr ? t("withdrawPassword.empty") : dirty ? null : error;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wdp-title"
        aria-describedby="wdp-desc"
      >
        <h2 className="wd__title" id="wdp-title">{t("withdrawPassword.title")}</h2>
        <p className="wd__guide" id="wdp-desc">{t("withdrawPassword.guide")}</p>

        <input
          ref={inputRef}
          className={`wdp__input ${shownError ? "is-error" : ""}`}
          type="password"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("withdrawPassword.placeholder")}
          aria-label={t("withdrawPassword.a11y")}
          aria-invalid={!!shownError}
          value={password}
          disabled={loading}
          onChange={(e) => {
            setPassword(e.target.value);
            setEmptyErr(false);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <p className="wdp__err" role="alert" aria-live="assertive">{shownError ?? ""}</p>

        <div className="wd__actions">
          <button className="wd__btn wd__btn--cancel" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </button>
          <button className="wd__btn wd__btn--go" onClick={submit} disabled={loading} aria-label={t("withdraw.confirmA11y")}>
            {loading ? <Spinner size={22} stroke={2.5} /> : t("withdraw.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
