import { useEffect, useRef, useState } from "react";
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
  const restoreRef = useRef<HTMLElement | null>(null);

  // Reset secure state whenever the modal (re)opens; clear on close.
  useEffect(() => {
    setPassword("");
    setEmptyErr(false);
    setDirty(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the field once the dialog is presented.
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);

    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>("input, button:not([disabled])") ?? [],
      );

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!loading) {
          e.preventDefault();
          onCancel();
        }
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, loading, onCancel]);

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
