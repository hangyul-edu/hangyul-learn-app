/**
 * Single source of truth for the app's supported display languages.
 *
 * This module owns the language *identity* (what a language is, how a value is
 * normalized to one, where the choice is persisted). The message catalogs and
 * the React binding live in `src/i18n`, which builds on this.
 */
export type AppLanguage = "en" | "ko";

export const SUPPORTED_LANGUAGES: { code: AppLanguage; nativeLabel: string }[] = [
  { code: "en", nativeLabel: "English" },
  { code: "ko", nativeLabel: "한국어" },
];

export const DEFAULT_LANGUAGE: AppLanguage = "en";

/** Where the choice survives a reload, ahead of the profile round-trip. */
export const LANGUAGE_STORAGE_KEY = "hangyul.language.v1";

const CODES = new Set<string>(SUPPORTED_LANGUAGES.map((l) => l.code));

/**
 * Clamp any stored, server-returned, or browser-reported value to a supported
 * language. Accepts full locale tags (`ko-KR`, `en_US`) and any casing, since
 * the value can come from `navigator.language` as well as from our own API.
 */
export function normalizeLanguage(value: string | null | undefined): AppLanguage {
  if (!value) return DEFAULT_LANGUAGE;
  const base = value.toLowerCase().replace("_", "-").split("-")[0];
  return CODES.has(base) ? (base as AppLanguage) : DEFAULT_LANGUAGE;
}

/** The language to use before any explicit choice exists. */
export function detectLanguage(): AppLanguage {
  if (typeof navigator === "undefined") return DEFAULT_LANGUAGE;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = (tag ?? "").toLowerCase().split("-")[0];
    if (CODES.has(base)) return base as AppLanguage;
  }
  return DEFAULT_LANGUAGE;
}

/** The persisted choice, or null when the user has not chosen one. */
export function loadStoredLanguage(): AppLanguage | null {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw && CODES.has(raw) ? (raw as AppLanguage) : null;
  } catch {
    return null; // private mode / storage disabled
  }
}

/** The language the app is shown in right now (the chosen one, else the
 * device's) — what server-sent messages (verification SMS / email) use. */
export function activeLanguage(): AppLanguage {
  return loadStoredLanguage() ?? detectLanguage();
}

export function saveStoredLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* non-fatal: the profile still carries the choice across devices */
  }
}
