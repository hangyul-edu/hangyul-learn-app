/**
 * React binding for the translation layer.
 *
 * Where the active language comes from:
 *   - signed in: the account's `app_language`, always — it is what Language
 *     Settings shows as selected, so the screen and the app can never
 *     disagree (see hooks/useAccountLanguage);
 *   - signed out: the device's choice (first-run picker, or the last
 *     account's language) from localStorage, else the browser's preferred
 *     language, else `DEFAULT_LANGUAGE`.
 *
 * Every applied language is also stored on the device, so a reload or the
 * signed-out screens open in it straight away.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  detectLanguage,
  loadStoredLanguage,
  saveStoredLanguage,
  type AppLanguage,
} from "../lib/language";
import { parts, plain, translate, type TranslationKey } from "./translate";
import { setCurrentLanguage } from "./current";
import type { MessageVars } from "./types";

interface I18nCtx {
  language: AppLanguage;
  /** Apply a language and store it on the device. */
  setLanguage: (language: AppLanguage) => void;
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

  useEffect(() => {
    if (forced !== undefined) setLanguageState(forced);
  }, [forced]);

  const setLanguage = useCallback((next: AppLanguage) => {
    saveStoredLanguage(next);
    setLanguageState(next);
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
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
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
export function T({ k, vars, strongClass }: { k: TranslationKey; vars?: MessageVars; strongClass?: string }) {
  const { language } = useI18n();
  const segments = parts(translate(language, k, vars));
  return (
    <>
      {segments.map((p, i) =>
        !p.strong ? (
          <span key={i}>{p.text}</span>
        ) : strongClass ? (
          // A design-specific emphasis (a colour, not bold).
          <span className={strongClass} key={i}>
            {p.text}
          </span>
        ) : (
          <b key={i}>{p.text}</b>
        ),
      )}
    </>
  );
}
