import { useRef, type ReactNode } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";

/**
 * Shared temporary-failure alert modal (withdrawal failed / logout failed / …).
 * Shown only for a retryable failure after the action's API was attempted. It
 * calls no API, logs nobody out, and clears no state — the single 확인 action
 * closes it (onClose) so the user can retry later. Backdrop is non-dismissable;
 * focus is trapped and restored to the opener on close.
 */
export function FailModal({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({ open, containerRef: dialogRef, onEscape: onClose });

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wfa"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wfa-title"
        aria-describedby="wfa-desc"
      >
        {/* SET-007 draws the failure mark as the ⚠ character, not a vector. */}
        <div className="wfa__icon" aria-hidden="true">⚠</div>

        <h2 className="wfa__title" id="wfa-title">{title}</h2>
        <p className="wfa__body" id="wfa-desc">{description}</p>

        <button className="wfa__btn" onClick={onClose}>{t("common.confirm")}</button>
      </div>
    </div>
  );
}
