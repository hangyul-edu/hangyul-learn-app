import { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import { Spinner } from "./ui/Spinner";

/**
 * Account-withdrawal reconfirmation modal. Destructive-action gate shown over
 * the More screen: it never calls any API on open — deletion runs only when the
 * user explicitly taps 탈퇴 (onConfirm). The backdrop is intentionally NOT a
 * dismiss target (consequential confirmation); only 취소 or Escape close it, and
 * both are disabled while a deletion request is in flight. Focus is trapped
 * inside and restored to the opener (the 탈퇴하기 item) on close.
 *
 * Legal copy is the approved product/withdrawal wording.
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
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({ open, containerRef: dialogRef, onEscape: loading ? undefined : onCancel });

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
        <h2 className="wd__title" id="wd-title">{t("withdraw.title")}</h2>
        {/* Both frames break this over two lines at their own point, so the
            break travels in the message (`white-space: pre-line`). */}
        <p className="wd__guide" id="wd-desc">
          {t("withdraw.subtitle")}
        </p>

        <div className="wd__panel">
          <h3 className="wd__panel-title">{t("withdraw.noticeTitle")}</h3>
          <ul className="wd__list">
            <li className="wd__item">{t("withdraw.notice1")}</li>
            <li className="wd__item">{t("withdraw.notice2")}</li>
            {/* Figma colours only the last bullet Negative (1:5726). */}
            <li className="wd__item wd__item--warn">{t("withdraw.notice3")}</li>
          </ul>
        </div>

        <div className="wd__actions">
          <button className="wd__btn wd__btn--cancel" onClick={onCancel} disabled={loading}>
            {t("withdraw.cancel")}
          </button>
          <button className="wd__btn wd__btn--go" onClick={onConfirm} disabled={loading} aria-label={t("withdraw.confirmA11y")}>
            {loading ? <Spinner size={22} stroke={2.5} /> : t("withdraw.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
