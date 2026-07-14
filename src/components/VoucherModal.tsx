import { useEffect, useRef, useState } from "react";

/**
 * Course-access code ("수강권 코드") registration modal. Opening it calls no API;
 * only 등록하기 triggers the parent's `onSubmit(code)`, which runs the existing
 * redemption flow (validateCoupon → applyCoupon) and refreshes authoritative
 * entitlement state. The `code` is controlled by the parent so it survives a swap
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
  const [emptyErr, setEmptyErr] = useState(false);
  const [dirty, setDirty] = useState(false); // typed since last submit → hide server error
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Reset only transient validation UI on open; the code itself is parent-owned.
  useEffect(() => {
    setEmptyErr(false);
    setDirty(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);

    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("input, button:not([disabled])") ?? []);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!loading) {
          e.preventDefault();
          onClose();
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
  }, [open, loading, onClose]);

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

  const shownError = emptyErr ? "코드를 입력해주세요." : dirty ? null : error;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="vou"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vou-title"
        aria-describedby="vou-desc"
      >
        <button className="wdd__close" onClick={onClose} aria-label="수강권 코드 등록 창 닫기" disabled={loading}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="vou__title" id="vou-title">수강권 코드 등록</h2>
        <p className="vou__guide" id="vou-desc">별도로 받으신 코드가 있으신 경우 등록하실 수 있습니다</p>

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
          aria-label="수강권 코드"
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
            <li className="wd__item">코드 확인 후 즉시 구독 적용</li>
            <li className="wd__item">기존 구독 종료 후 순차 적용</li>
            <li className="wd__item">1회 사용 후 재사용 불가</li>
          </ul>
        </div>

        <button className="vou__submit" onClick={submit} disabled={loading || !code.trim()}>
          {loading ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "등록하기"}
        </button>
      </div>
    </div>
  );
}
