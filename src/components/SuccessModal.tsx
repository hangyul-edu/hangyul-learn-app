import { useRef, type ReactNode } from "react";
import { useModalFocus } from "../hooks/useModalFocus";
import { useTranslation } from "../i18n";
import doneBadge from "../assets/brand/ic-modal-done.svg";

/**
 * Shared terminal-success modal (account-withdrawal complete / logout complete).
 * Shown ONLY after the backend confirms the terminal operation — it never calls
 * any API. Laid out from MOR-007 (KO 3085:27764 / EN 3085:29141), which carries a single orange
 * 확인 and no dismiss affordance of its own, so 확인 / Escape are the only ways
 * out (`onClose`) and the parent runs the centralized cleanup + navigation
 * reset. Backdrop is non-dismissable; focus is trapped; there is no
 * authenticated screen to return to.
 */
export function SuccessModal({
  open,
  title,
  description,
  onClose,
  icon = doneBadge,
  confirmLabel,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  onClose: () => void;
  /** The button's label: OK (2231:24627) unless the frame says otherwise —
   *  MOR-007 / MOR-009 read Confirm. */
  confirmLabel?: string;
  /** 60px status badge. Defaults to MOR-007's mint disc; AME-006's profile
   *  modal (2231:24627) uses the green ic-modal-success one instead. */
  icon?: string;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalFocus({ open, containerRef: dialogRef, onEscape: onClose, initialFocus: ".wdd__btn" });

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div
        ref={dialogRef}
        className="wdd"
        role="dialog"
        aria-modal="true"
        aria-labelledby="succ-title"
        aria-describedby="succ-desc"
      >
        <div className="wdd__icon" aria-hidden="true">
          <img src={icon} alt="" />
        </div>

        <h2 className="wdd__title" id="succ-title">{title}</h2>
        <p className="wdd__copy" id="succ-desc">{description}</p>

        <button className="wdd__btn" onClick={onClose}>{confirmLabel ?? t("common.ok")}</button>
      </div>
    </div>
  );
}
