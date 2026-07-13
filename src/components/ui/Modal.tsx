import { useEffect } from "react";
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

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  useLockScroll(open);
  if (!open) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" />
        {title && (
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
