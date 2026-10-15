import { useEffect, useId, useRef } from "react";
import { useTranslation } from "../../i18n";
import { createPortal } from "react-dom";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { Button } from "./kit";

/**
 * Move focus into the modal when it opens and give it back to whatever had it
 * (the trigger) when it closes. `preventScroll` is essential for the sheet: it
 * starts off-screen (sliding up), so a scrolling focus would drag the fixed
 * background along with it.
 */
function useFocusInside(open: boolean, ref: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus?.({ preventScroll: true });
  }, [open, ref]);
}

/**
 * Escape closes the modal it was pressed in. The handler sits on the modal
 * itself (focus is moved inside), so only the topmost of two stacked modals
 * closes. A control that already used the key, or an IME composition the key
 * cancels (Korean input), is left alone; without `onClose` the modal is not
 * dismissable right now (e.g. while its action is pending).
 */
function escapeCloses(onClose?: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== "Escape" || !onClose || e.defaultPrevented || e.nativeEvent.isComposing) return;
    e.stopPropagation();
    onClose();
  };
}

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
 *
 * The entry is tied to `open` alone. Callers pass inline `onClose` arrows, and
 * re-running on every new one would pop and re-push the entry — the pop is
 * asynchronous, so it lands on the fresh entry and closes the sheet unasked.
 */
function useHardwareBackClose(open: boolean, onClose: () => void) {
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    closing.current = false;
    window.history.pushState({ sheet: true }, "");
    const onPop = () => {
      if (closing.current) return;
      closing.current = true;
      onCloseRef.current();
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
  }, [open]);
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  bare = false,
  label,
  contained = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Omit the grip + default title chrome so children own the header. */
  bare?: boolean;
  /** Accessible name for the modal when there is no visible title element;
   *  otherwise the visible title names it. */
  label?: string;
  /** Render inside the phone frame (absolute, clipped to its rounded corners),
   *  matching the League guide, instead of a viewport-fixed overlay. */
  contained?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useLockScroll(open);
  useHardwareBackClose(open, onClose);
  useFocusInside(open, sheetRef);

  if (!open) return null;
  const showTitle = !bare && !!title;
  const overlay = (
    <div className={`overlay ${contained ? "overlay--contained" : ""}`} onClick={onClose}>
      <div
        ref={sheetRef}
        className={`sheet ${bare ? "sheet--bare" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={!label && showTitle ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={escapeCloses(onClose)}
      >
        {!bare && <div className="sheet__grip" />}
        {showTitle && (
          <h3 id={titleId} className="sheet__title">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
  // Contained sheets portal into the phone frame so its overflow clips them to
  // the rounded corners regardless of where the trigger lives in the tree.
  if (contained) {
    const host = document.querySelector(".app-frame") ?? document.body;
    return createPortal(overlay, host);
  }
  return overlay;
}

export function Dialog({
  open,
  onClose,
  emoji,
  title,
  warn,
  text,
  children,
}: {
  open: boolean;
  onClose?: () => void;
  emoji?: string;
  title: ReactNode;
  /** Brand-orange emphasis line between the title and the body (624:10159). */
  warn?: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useLockScroll(open);
  useFocusInside(open, dialogRef);
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="overlay overlay--center" onClick={onClose}>
      <div
        ref={dialogRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={escapeCloses(onClose)}
      >
        {emoji && <div className="dialog__emoji">{emoji}</div>}
        <div className="dialog__title" id={titleId}>{title}</div>
        {warn && <div className="dialog__warn">{warn}</div>}
        {text && <div className="dialog__text">{text}</div>}
        {children}
      </div>
    </div>
  );
}

/**
 * Two-choice confirmation — Figma cp_G_01_modals (MOR-005 1:5727,
 * MOR-011 624:10160): the actions sit side by side as two equal 136px buttons
 * with an 8px gap, cancel first.
 */
export function ConfirmDialog({
  open,
  emoji,
  title,
  warn,
  text,
  confirmLabel,
  cancelLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  /** No Figma confirmation carries a badge; opt in only where one is designed. */
  emoji?: string;
  title: ReactNode;
  warn?: ReactNode;
  text?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} emoji={emoji} title={title} warn={warn} text={text}>
      {/* Both buttons are cp_C_01_primaryBtn: the dismissing one on bgray.400,
          the committing one on Brand 1 — never an outline or a red. */}
      <div className="dialog__actions">
        <Button variant="ghost" block onClick={onCancel} disabled={loading}>
          {cancelLabel ?? t("common.cancel")}
        </Button>
        <Button variant="primary" block loading={loading} onClick={onConfirm}>
          {confirmLabel ?? t("common.confirm")}
        </Button>
      </div>
    </Dialog>
  );
}
