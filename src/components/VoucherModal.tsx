import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import closeIcon from "../assets/brand/ic-modal-close.svg";
import { Spinner } from "./ui/Spinner";

/**
 * Course-access code ("수강권 코드") registration modal. Opening it calls no API;
 * only 등록하기 triggers the parent's `onSubmit(code)`, which runs the redemption
 * and refreshes authoritative entitlement state. The `code` is controlled by the parent so it survives a swap
 * to the failure modal and back (edit-and-retry). The server decides validity,
 * eligibility, immediate-vs-scheduled application, and one-time use.
 *
 * Backdrop is non-dismissable; X / Escape close without submitting, both disabled
 * while a request is in flight. Focus is trapped and the input is focused on open.
 */
export function VoucherModal({
  open,
  loading,
  error,
  code,
  onCodeChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  /** Server-reported error (user-safe copy) for the last submit, or null. */
  error: string | null;
  /** Controlled canonical code value (owned by the parent). */
  code: string;
  onCodeChange: (v: string) => void;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const { t, language } = useTranslation();
  const [emptyErr, setEmptyErr] = useState(false);
  const [dirty, setDirty] = useState(false); // typed since last submit → hide server error
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset only transient validation UI on open; the code itself is parent-owned.
  useEffect(() => {
    setEmptyErr(false);
    setDirty(false);
  }, [open]);

  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: loading ? undefined : onClose,
    initialFocus: inputRef,
    focusDelayMs: 50,
    focusables: "input, button:not([disabled])",
  });

  if (!open) return null;

  function submit() {
    if (loading) return;
    const value = code.trim();
    if (!value) {
      setEmptyErr(true);
      inputRef.current?.focus();
      return;
    }
    setDirty(false);
    onSubmit(value);
  }

  const shownError = emptyErr ? t("voucher.empty") : dirty ? null : error;
  // Only the English frame (1217:22445) carries a line under the title; the
  // Korean one (1215:21452) goes straight from the title to the field.
  const subtitle = language === "ko" ? null : t("voucher.subtitle");

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="vou"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vou-title"
      >
        <button className="vou__close" onClick={onClose} aria-label={t("voucher.closeA11y")} disabled={loading}>
          <img src={closeIcon} alt="" aria-hidden="true" />
        </button>

        <h2 className="vou__title" id="vou-title">{t("voucher.title")}</h2>
        {subtitle && <p className="vou__subtitle">{subtitle}</p>}

        <input
          ref={inputRef}
          className={`vou__input ${shownError ? "is-error" : ""}`}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          placeholder="ABCD-1234-EFGH"
          aria-label={t("voucher.codeA11y")}
          aria-invalid={!!shownError}
          value={code}
          disabled={loading}
          onChange={(e) => {
            // Canonical charset only: A–Z, 0–9, hyphen (uppercased).
            onCodeChange(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
            setEmptyErr(false);
            setDirty(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        {shownError && <p className="vou__err" role="alert" aria-live="assertive">{shownError}</p>}

        <div className="wd__panel">
          <ul className="wd__list">
            <li className="wd__item">{t("voucher.note1")}</li>
            <li className="wd__item">{t("voucher.note2")}</li>
            <li className="wd__item">{t("voucherSuccess.singleUse")}</li>
          </ul>
        </div>

        <button className="vou__submit" onClick={submit} disabled={loading || !code.trim()}>
          {loading ? <Spinner size={22} stroke={2.5} /> : t("voucher.submit")}
        </button>
      </div>
    </div>
  );
}
