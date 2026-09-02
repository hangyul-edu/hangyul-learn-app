import { useTranslation } from "../i18n";

/** Notices list/detail copy, bound to the active language (`notice.*`). */
export function useNoticesCopy() {
  const { t } = useTranslation();
  return {
    title: t("notice.title"),
    back: t("common.back"),
    empty: t("notice.empty"),
    errorTitle: t("notice.errorTitle"),
    retry: t("common.retry"),
    notFoundTitle: t("notice.notFoundTitle"),
    notFoundBody: t("notice.notFoundBody"),
    backToList: t("notice.backToList"),
    newBadgeLabel: t("notice.newBadgeLabel"),
  };
}
