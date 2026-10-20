import { useRef } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import gradingBadge from "../assets/brand/ic-modal-grading.svg";

/**
 * "채점 중이에요" — cp_G_01_modals 2677:26028 (KO) / 2678:26338 (EN): the wait
 * while the server grades a writing answer. The frame has no button and no
 * close affordance, so it cannot be dismissed; it leaves with the result
 * (the caller unmounts it). Same 60px badge card as the status modals, minus
 * the CTA.
 */
export function GradingModal() {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Scroll lock only: nothing inside takes focus and Escape does nothing.
  useModalFocus({ open: true, containerRef: dialogRef, initialFocus: "none", trap: false });
  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdd wdd--wait"
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-labelledby="grd-title"
        aria-describedby="grd-desc"
      >
        <div className="wdd__icon" aria-hidden="true">
          <img src={gradingBadge} alt="" />
        </div>
        <h2 className="wdd__title" id="grd-title">{t("session.gradingTitle")}</h2>
        <p className="wdd__copy" id="grd-desc">{t("session.gradingText")}</p>
      </div>
    </div>
  );
}
