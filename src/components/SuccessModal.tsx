import { useEffect, useRef, type ReactNode } from "react";
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
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  onClose: () => void;
  /** 60px status badge. Defaults to MOR-007's mint disc; AME-006's profile
   *  modal (2231:24627) uses the green ic-modal-success one instead. */
  icon?: string;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    // Focus the primary action.
    focusables().find((b) => b.classList.contains("wdd__btn"))?.focus();

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
    };
  }, [open, onClose]);

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

        <button className="wdd__btn" onClick={onClose}>{t("common.confirm")}</button>
      </div>
    </div>
  );
}
