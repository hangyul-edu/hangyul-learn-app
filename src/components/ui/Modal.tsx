import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./kit";

function useLockScroll(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/**
 * When open, push a history entry so the device/browser Back gesture closes
 * the sheet (instead of navigating away). Repeated closes are guarded so the
 * back entry is only consumed once.
 */
function useHardwareBackClose(open: boolean, onClose: () => void) {
  const closing = useRef(false);
  useEffect(() => {
    if (!open) return;
    closing.current = false;
    window.history.pushState({ sheet: true }, "");
    const onPop = () => {
      if (closing.current) return;
      closing.current = true;
      onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // If the sheet closed by other means (X / backdrop), drop the extra entry.
      if (!closing.current && window.history.state?.sheet) {
        closing.current = true;
        window.history.back();
      }
    };
  }, [open, onClose]);
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  bare = false,
  label,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Omit the grip + default title chrome so children own the header. */
  bare?: boolean;
  /** Accessible name for the modal when there is no visible title element. */
  label?: string;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useLockScroll(open);
  useHardwareBackClose(open, onClose);

  // Move focus into the sheet on open; restore it to the trigger on close.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className={`sheet ${bare ? "sheet--bare" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {!bare && <div className="sheet__grip" />}
        {!bare && title && (
          <h3 style={{ fontSize: 18, marginBottom: 14, paddingLeft: 2 }}>{title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  onClose,
  emoji,
  title,
  text,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  emoji?: string;
  title: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
}) {
  useLockScroll(open);
  if (!open) return null;
  return (
    <div className="overlay overlay--center" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        {emoji && <div className="dialog__emoji">{emoji}</div>}
        <div className="dialog__title">{title}</div>
        {text && <div className="dialog__text">{text}</div>}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  emoji = "❓",
  title,
  text,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  emoji?: string;
  title: ReactNode;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} emoji={emoji} title={title} text={text}>
      <div className="stack" style={{ gap: 9 }}>
        <Button variant={danger ? "danger" : "primary"} block loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" block onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
      </div>
    </Dialog>
  );
}
