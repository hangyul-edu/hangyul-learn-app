import { useTranslation } from "../i18n";

/**
 * Attendance-modal copy, bound to the active language.
 *
 * The strings live in the i18n catalogs (`attendance.*`); this hook is a typed
 * view over them so the modal can keep reading `copy.title` / `copy.streak(n)`.
 */
export function useAttendanceCopy() {
  const { t } = useTranslation();
  return {
    title: t("attendance.title"),
    streak: (days: number) => t("attendance.streak", { days }),
    points: (points: number) => t("attendance.points", { points }),
    confirm: t("attendance.confirm"),
    closeA11y: t("attendance.closeA11y"),
    confirmA11y: t("attendance.confirmA11y"),
    dialogA11y: t("attendance.dialogA11y"),
  };
}
