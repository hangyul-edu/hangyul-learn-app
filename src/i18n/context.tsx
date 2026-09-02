/**
 * React binding for the translation layer.
 *
 * Resolution order for the active language, strongest first:
 *   1. an explicit in-session choice (Language Settings)
 *   2. the value persisted in localStorage
 *   3. `app_language` on the signed-in profile, so the choice follows the user
 *      across devices
 *   4. the browser's preferred language
 *   5. `DEFAULT_LANGUAGE`
 *
 * The profile only *seeds* the language: once someone chooses in-session, a
 * later profile refetch must not yank the UI back. `chosenRef` records that.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  detectLanguage,
  loadStoredLanguage,
  normalizeLanguage,
  saveStoredLanguage,
  type AppLanguage,
} from "../lib/language";
import { parts, plain, translate, type TranslationKey } from "./translate";
import { setCurrentLanguage } from "./current";
import type { MessageVars } from "./types";

interface I18nCtx {
  language: AppLanguage;
  /** Persist and apply a language chosen by the user. */
  setLanguage: (language: AppLanguage) => void;
  /**
   * Adopt a language from the server profile — only if the user has not chosen
   * one in this session or persisted one locally.
   */
  adoptProfileLanguage: (value: string | null | undefined) => void;
  /** Translate a key, substituting `{placeholder}` vars. Emphasis markers are stripped. */
  t: (key: TranslationKey, vars?: MessageVars) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

function initialLanguage(): AppLanguage {
  return loadStoredLanguage() ?? detectLanguage();
}

export function I18nProvider({
  children,
  /** Test seam: forces a language and skips detection/persistence. */
  language: forced,
}: {
  children: ReactNode;
  language?: AppLanguage;
}) {
  const [language, setLanguageState] = useState<AppLanguage>(() => forced ?? initialLanguage());
  // True once the language is user-owned (chosen in-session or previously
  // persisted), which makes it immune to the profile seeding below.
  const chosenRef = useRef(forced !== undefined || loadStoredLanguage() !== null);

  useEffect(() => {
    if (forced !== undefined) setLanguageState(forced);
  }, [forced]);

  const setLanguage = useCallback((next: AppLanguage) => {
    chosenRef.current = true;
    saveStoredLanguage(next);
    setLanguageState(next);
  }, []);

  const adoptProfileLanguage = useCallback((value: string | null | undefined) => {
    if (chosenRef.current || value == null) return;
    setLanguageState(normalizeLanguage(value));
  }, []);

  // Keep the document in sync: `lang` drives font fallback, hyphenation and
  // screen-reader pronunciation, and the language-specific type sizes in CSS.
  // The module-level register serves the few callers that format messages
  // outside the tree (see i18n/current.ts).
  useEffect(() => {
    document.documentElement.lang = language;
    setCurrentLanguage(language);
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, vars?: MessageVars) => plain(translate(language, key, vars)),
    [language],
  );

  const value = useMemo<I18nCtx>(
    () => ({ language, setLanguage, adoptProfileLanguage, t }),
    [language, setLanguage, adoptProfileLanguage, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}

/** The common case: `const { t } = useTranslation()`. */
export function useTranslation(): I18nCtx {
  return useI18n();
}

/**
 * Render a message that carries an emphasised `<s>…</s>` segment.
 *
 * Home's greeting is "<s>{name}님,</s> 반가워요!" in Korean and
 * "Welcome, <s>{name}!</s>" in English — same component, same key, emphasis in
 * the position each design puts it.
 */
export function T({ k, vars }: { k: TranslationKey; vars?: MessageVars }) {
  const { language } = useI18n();
  const segments = parts(translate(language, k, vars));
  return (
    <>
      {segments.map((p, i) => (p.strong ? <b key={i}>{p.text}</b> : <span key={i}>{p.text}</span>))}
    </>
  );
}
