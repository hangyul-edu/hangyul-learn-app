/**
 * Public surface of the i18n layer.
 *
 * Screens should import from here (`import { useTranslation } from "../i18n"`)
 * rather than reaching into the individual modules.
 */
export { I18nProvider, useI18n, useTranslation, T } from "./context";
export { translate, resolve, interpolate, parts, plain, CATALOGS } from "./translate";
export { tCurrent, resolveMessage, isMessageKey, setCurrentLanguage, getCurrentLanguage } from "./current";
export type { TranslationKey } from "./translate";
export type { MessageVars } from "./types";
export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  normalizeLanguage,
  detectLanguage,
  type AppLanguage,
} from "../lib/language";
