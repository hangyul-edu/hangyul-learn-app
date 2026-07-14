import { useEffect, useRef } from "react";

/**
 * Account-withdrawal reconfirmation modal. Destructive-action gate shown over
 * the More screen: it never calls any API on open — deletion runs only when the
 * user explicitly taps 탈퇴 (onConfirm). The backdrop is intentionally NOT a
 * dismiss target (consequential confirmation); only 취소 or Escape close it, and
 * both are disabled while a deletion request is in flight. Focus is trapped
 * inside and restored to the opener (the 탈퇴하기 item) on close.
 *
 * Legal copy is the approved product/withdrawal wording (see the report note on
 * subscription-cancellation behavior).
 */
export function WithdrawModal({
  open,
  loading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
    focusables()[0]?.focus();

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
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wd-title"
        aria-describedby="wd-desc"
      >
        <h2 className="wd__title" id="wd-title">회원 탈퇴</h2>
        <p className="wd__guide" id="wd-desc">
          아래의 안내 사항을 확인 후
          <br />
          맨 아래의 탈퇴 신청 버튼을 눌러주세요
        </p>

        <div className="wd__panel">
          <h3 className="wd__panel-title">서비스 탈퇴 안내 사항</h3>
          <ul className="wd__list">
            <li className="wd__item">탈퇴 이후에는 해당 계정으로 다시 가입할 수 없습니다.</li>
            <li className="wd__item">
              탈퇴 이후 ‘학습 기록, 코스 기록 등’에 대한 복구는 불가능하며 로그인이 필요한 모든 서비스를 이용하실 수 없습니다.
            </li>
            <li className="wd__item wd__item--warn">
              탈퇴하신 경우 결제하신 서비스 이용 권한과 구독권을 포기하는 것으로 간주하며 구독권이 자동 해지되며 구독료가 환불되지 않습니다.
            </li>
          </ul>
        </div>

        <div className="wd__actions">
          <button className="wd__btn wd__btn--cancel" onClick={onCancel} disabled={loading}>
            취소
          </button>
          <button className="wd__btn wd__btn--go" onClick={onConfirm} disabled={loading} aria-label="회원 탈퇴 진행">
            {loading ? <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2.5 }} /> : "탈퇴"}
          </button>
        </div>
      </div>
    </div>
  );
}
