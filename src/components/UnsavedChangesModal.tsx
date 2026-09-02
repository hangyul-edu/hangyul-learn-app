import { useEffect, useRef } from "react";
import { useTranslation } from "../i18n";

/**
 * Unsaved-changes confirmation modal. The left (gray) button keeps the user on
 * the screen with their draft intact; the right (orange) `나가기` discards and
 * leaves. Calls no API. Backdrop is non-dismissable and Escape maps to the
 * cancel action (never 나가기). Focus is trapped and restored to the opener on
 * close. Reuses the shared two-button dialog styles (.lgo__*).
 *
 * Copy is customizable per screen (`title` / `subtitle` / `cancelLabel`); the
 * defaults preserve the original wording for existing call sites.
 */
export function UnsavedChangesModal({
  open,
  onContinue,
  onLeave,
  title,
  subtitle,
  cancelLabel,
  leaveLabel,
}: {
  open: boolean;
  onContinue: () => void;
  onLeave: () => void;
  title?: string;
  subtitle?: string;
  cancelLabel?: string;
  leaveLabel?: string;
}) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    focusables()[0]?.focus(); // "keep editing" (safe default)

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onContinue();
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
      restoreRef.current?.focus?.();
    };
  }, [open, onContinue]);

  if (!open) return null;

  return (
    <div className="overlay overlay--center wd__overlay">
      <div ref={dialogRef} className="lgo" role="alertdialog" aria-modal="true" aria-labelledby="unsaved-title" aria-describedby="unsaved-desc">
        <h2 className="lgo__title" id="unsaved-title">{title ?? t("misc.unsavedTitle")}</h2>
        <p className="lgo__copy" id="unsaved-desc">{subtitle ?? t("misc.unsavedBody")}</p>
        <div className="lgo__actions">
          <button className="lgo__btn lgo__btn--cancel" onClick={onContinue}>{cancelLabel ?? t("misc.unsavedContinue")}</button>
          <button className="lgo__btn lgo__btn--go" onClick={onLeave}>{leaveLabel ?? t("misc.unsavedLeave")}</button>
        </div>
      </div>
    </div>
  );
}
