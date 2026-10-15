import { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import successBadge from "../assets/brand/ic-modal-success.svg";

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
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({ open, containerRef: dialogRef, onEscape: onClose, initialFocus: ".vsc__confirm" });

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
        {/* MOR-018 carries no dismiss X — 확인 and Escape are the only exits. */}
        <div className="vsc__icon" aria-hidden="true">
          <img src={successBadge} alt="" />
        </div>

        <h2 className="vsc__title" id="vsc-title">{t("voucherSuccess.title")}</h2>
        <p className="vsc__subtitle" id="vsc-desc">{data.subtitle}</p>

        <div className="vsc__label">{t("voucherSuccess.appliedPlan")}</div>
        <dl className="wd__panel vsc__panel">
          <div className="vsc__row">
            <dt className="vsc__k">{t("voucherSuccess.plan")}</dt>
            <dd className="vsc__v">{data.plan}</dd>
          </div>
          <div className="vsc__row">
            <dt className="vsc__k">{t("voucherSuccess.subType")}</dt>
            <dd className="vsc__v">{data.type}</dd>
          </div>
          <div className="vsc__row">
            <dt className="vsc__k">{t("voucherSuccess.validity")}</dt>
            <dd className="vsc__v">{data.validity}</dd>
          </div>
        </dl>

        <button className="vsc__confirm" onClick={onClose}>{t("common.confirm")}</button>
      </div>
    </div>
  );
}
