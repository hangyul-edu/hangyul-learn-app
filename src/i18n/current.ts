/**
 * Module-level view of the active language, for the few places that must format
 * a message outside the React tree — chiefly `errorMessage()`, which is called
 * from ~130 mutation handlers that have no access to a hook.
 *
 * `I18nProvider` keeps this in sync; it is never the source of truth. Anything
 * inside the tree should use `useTranslation()` instead so it re-renders when
 * the language changes.
 */
import { DEFAULT_LANGUAGE, type AppLanguage } from "../lib/language";
import { CATALOGS, translate } from "./translate";
import type { CatalogNode, MessageVars } from "./types";

let current: AppLanguage = DEFAULT_LANGUAGE;

export function setCurrentLanguage(language: AppLanguage): void {
  current = language;
}

export function getCurrentLanguage(): AppLanguage {
  return current;
}

/** Every leaf path in the reference catalog, for `isMessageKey`. */
const KEYS: ReadonlySet<string> = (() => {
  const out = new Set<string>();
  const walk = (node: CatalogNode, prefix: string) => {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string") out.add(prefix + k);
      else walk(v, `${prefix}${k}.`);
    }
  };
  walk(CATALOGS.ko as CatalogNode, "");
  return out;
})();

/**
 * True when a string is one of our message keys rather than display text.
 *
 * `errorMessage()` returns a mix: the server's own `detail` sentence when it
 * sends one, and a catalog key when it doesn't. This tells them apart so a raw
 * key never reaches the screen.
 */
export function isMessageKey(value: string): boolean {
  return KEYS.has(value);
}

/** Format a message in the current language. Prefer `useTranslation()` in components. */
export function tCurrent(key: string, vars?: MessageVars): string {
  return translate(current, key, vars);
}

/** Pass display text through untouched; resolve anything that is a message key. */
export function resolveMessage(value: string): string {
  return isMessageKey(value) ? tCurrent(value) : value;
}
