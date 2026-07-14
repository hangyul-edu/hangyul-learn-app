import { useEffect, useRef } from "react";

export interface VoucherSuccess {
  /** Outcome-accurate subtitle (immediate vs scheduled), server-derived. */
  subtitle: string;
  plan: string;
  type: string;
  validity: string;
}

/**
 * Coupon / course-access-code redemption SUCCESS modal. Shown only after the
 * backend confirms redemption; it calls no API. Both the top-right X and the
 * orange 확인 do the same thing — `onClose` (close + return to the already-
 * refreshed Subscription screen). The applied-subscription details are passed in
 * (built from the redemption response + refreshed /subscriptions/me), never
 * fabricated here. Backdrop is non-dismissable; focus is trapped.
 */
export function VoucherSuccessModal({
  open,
  data,
  onClose,
}: {
  open: boolean;
  data: VoucherSuccess | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables().find((b) => b.classList.contains("vsc__confirm"))?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
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
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || !data) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="vsc"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vsc-title"
        aria-describedby="vsc-desc"
      >
        <button className="wdd__close" onClick={onClose} aria-label="수강권 코드 등록 완료 창 닫기">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="#111" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="vsc__icon" aria-hidden="true">
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <path d="M13 24.5l7 7 15-15" stroke="#0D6E1B" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="vsc__title" id="vsc-title">쿠폰이 등록됐습니다</h2>
        <p className="vsc__subtitle" id="vsc-desc">{data.subtitle}</p>

        <div className="vsc__label">적용된 구독</div>
        <dl className="wd__panel vsc__panel">
          <div className="vsc__row">
            <dt className="vsc__k">플랜</dt>
            <dd className="vsc__v">{data.plan}</dd>
          </div>
          <div className="vsc__row">
            <dt className="vsc__k">구독 유형</dt>
            <dd className="vsc__v">{data.type}</dd>
          </div>
          <div className="vsc__row">
            <dt className="vsc__k">유효기간</dt>
            <dd className="vsc__v">{data.validity}</dd>
          </div>
        </dl>

        <button className="vsc__confirm" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}
