import type { AppLanguage } from "./language";

/**
 * Localized static UI text for the Notice list/detail screens, keyed by the
 * active app language. Notice *content* (title/body) is localized by the
 * backend; only chrome lives here — mirroring the LANGUAGE_SETTINGS_COPY pattern
 * until a full i18n layer exists.
 */
export interface NoticeCopy {
  title: string;
  back: string;
  empty: string;
  errorTitle: string;
  retry: string;
  notFoundTitle: string;
  notFoundBody: string;
  backToList: string;
  newBadgeLabel: string;
}

export const NOTICES_COPY: Record<AppLanguage, NoticeCopy> = {
  ko: {
    title: "공지사항",
    back: "뒤로 가기",
    empty: "아직 등록된 공지사항이 없어요",
    errorTitle: "공지사항을 불러오지 못했어요",
    retry: "다시 시도",
    notFoundTitle: "공지사항을 찾을 수 없어요",
    notFoundBody: "삭제되었거나 주소가 올바르지 않아요.",
    backToList: "공지사항 목록으로",
    newBadgeLabel: "새 공지",
  },
  en: {
    title: "Notices",
    back: "Go back",
    empty: "There are no notices yet.",
    errorTitle: "Couldn't load notices",
    retry: "Retry",
    notFoundTitle: "Notice not found",
    notFoundBody: "It may have been removed or the address is incorrect.",
    backToList: "Back to notices",
    newBadgeLabel: "New notice",
  },
};
