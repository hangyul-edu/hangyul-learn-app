/**
 * Single source of truth for the app's supported display languages.
 *
 * The app has no full i18n framework yet (UI strings are Korean literals), so
 * this module holds the supported-language config + the Language Settings
 * screen's copy keyed by language. When a real i18n layer is introduced, this
 * is the config it should build on rather than duplicating the language list.
 */
export type AppLanguage = "en" | "ko";

export const SUPPORTED_LANGUAGES: { code: AppLanguage; nativeLabel: string }[] = [
  { code: "en", nativeLabel: "English" },
  { code: "ko", nativeLabel: "한국어" },
];

/** Clamp any stored/returned value to a supported language; default is `en`. */
export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  return value === "ko" ? "ko" : "en";
}

/** Localized copy for the Language Settings screen, keyed by the active language. */
export const LANGUAGE_SETTINGS_COPY: Record<
  AppLanguage,
  {
    title: string;
    save: string;
    saveA11y: string;
    back: string;
    savedToast: string;
    errorToast: string;
    networkErrorToast: string;
  }
> = {
  en: {
    title: "Language Settings",
    save: "Save",
    saveA11y: "Save language setting",
    back: "Go back",
    savedToast: "Language setting saved",
    errorToast: "Unable to save the language setting. Please try again shortly.",
    networkErrorToast: "Check your network connection and try again.",
  },
  ko: {
    title: "언어 설정",
    save: "저장",
    saveA11y: "언어 설정 저장",
    back: "뒤로 가기",
    savedToast: "언어 설정을 저장했어요",
    errorToast: "언어 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.",
    networkErrorToast: "네트워크 연결을 확인한 후 다시 시도해 주세요.",
  },
};
