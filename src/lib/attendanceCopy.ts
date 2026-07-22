import type { AppLanguage } from "./language";

/**
 * Localized copy for the daily-attendance completion modal, keyed by the active
 * app language (mirrors the LANGUAGE_SETTINGS_COPY / NOTICES_COPY pattern until
 * a full i18n framework exists). Interpolated strings are functions so no
 * Korean/English literals live inside the component.
 */
export interface AttendanceCopy {
  title: string;
  streak: (days: number) => string;
  points: (points: number) => string;
  confirm: string;
  closeA11y: string;
  confirmA11y: string;
  dialogA11y: string;
}

export const ATTENDANCE_COPY: Record<AppLanguage, AttendanceCopy> = {
  ko: {
    title: "오늘 출석 완료!",
    streak: (days) => `연속 ${days}일 달성`,
    points: (points) => `+${points}P`,
    confirm: "확인",
    closeA11y: "출석 완료 창 닫기",
    confirmA11y: "출석 완료 확인",
    dialogA11y: "오늘 출석 완료",
  },
  en: {
    title: "Today's attendance is complete!",
    streak: (days) => `${days}-day streak achieved`,
    points: (points) => `+${points}P`,
    confirm: "Confirm",
    closeA11y: "Close attendance completion modal",
    confirmA11y: "Confirm attendance completion",
    dialogA11y: "Today's attendance is complete",
  },
};
