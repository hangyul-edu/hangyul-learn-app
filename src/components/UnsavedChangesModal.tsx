import { useTranslation } from "../i18n";
import { TwoButtonAlert } from "./ui/TwoButtonAlert";

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
  return (
    <TwoButtonAlert
      open={open}
      raised
      title={title ?? t("misc.unsavedTitle")}
      body={subtitle ?? t("misc.unsavedBody")}
      cancelLabel={cancelLabel ?? t("misc.unsavedContinue")}
      confirmLabel={leaveLabel ?? t("misc.unsavedLeave")}
      onCancel={onContinue}
      onConfirm={onLeave}
    />
  );
}
