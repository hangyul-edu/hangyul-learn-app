import { useId, useRef, type ReactNode } from "react";
import { useModalFocus } from "../../hooks/useModalFocus";
import { Spinner } from "./Spinner";

/**
 * The centred two-button alert (.lgo__*): a title, a line of copy, a gray
 * dismissing button and an orange committing one. Escape runs the dismissing
 * action (never the committing one), focus is trapped and goes back to the
 * opener; while `loading` both buttons are disabled and it cannot be dismissed.
 */
export function TwoButtonAlert({
  open,
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  loading = false,
  focus = "cancel",
  role = "alertdialog",
  backdropCancels = false,
  raised = false,
  centered = false,
}: {
  open: boolean;
  title: ReactNode;
  body: ReactNode;
  cancelLabel: ReactNode;
  confirmLabel: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  /** The button focused on open: the safe one, unless confirming is the point. */
  focus?: "cancel" | "confirm";
  role?: "dialog" | "alertdialog";
  /** A press on the backdrop dismisses (off by default). */
  backdropCancels?: boolean;
  /** Above the screen's other overlays (the account flows' layer). */
  raised?: boolean;
  /** Centre the copy (a multi-line message). */
  centered?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = useId();
  useModalFocus({
    open,
    containerRef: dialogRef,
    onEscape: loading ? undefined : onCancel,
    initialFocus: focus === "confirm" ? ".lgo__btn--go" : "first",
  });
  if (!open) return null;
  return (
    <div className={`overlay overlay--center${raised ? " wd__overlay" : ""}`} onClick={backdropCancels ? onCancel : undefined}>
      <div
        ref={dialogRef}
        className="lgo"
        role={role}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="lgo__title" id={`${id}-title`}>
          {title}
        </h2>
        <p className={`lgo__copy${centered ? " lgo__copy--center" : ""}`} id={`${id}-desc`}>
          {body}
        </p>
        <div className="lgo__actions">
          <button className="lgo__btn lgo__btn--cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button className="lgo__btn lgo__btn--go" onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner size={22} stroke={2.5} /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
