/**
 * Pure message lookup + formatting. Kept free of React so it can be unit-tested
 * and reused outside a component tree (e.g. formatting a notification body).
 */
import { ko, type Catalog } from "./locales/ko";
import { en } from "./locales/en";
import type { AppLanguage } from "../lib/language";
import type { CatalogNode, DotPaths, MessageVars } from "./types";

export const CATALOGS: Record<AppLanguage, Catalog> = { ko, en };

/** Every valid message key, e.g. `"home.greeting"`. */
export type TranslationKey = DotPaths<Catalog>;

/** Walk a dot path; returns undefined if the path is missing or hits a branch. */
function lookup(catalog: CatalogNode, key: string): string | undefined {
  let node: string | CatalogNode | undefined = catalog;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Resolve a key to its raw message.
 *
 * Falls back to Korean — the language the designs were authored in — so a key
 * added to `ko` but not yet transcribed from the English frame still renders
 * real copy rather than a bare key. `en` is typed against `ko`, so this can only
 * happen transiently while a catalog is being filled in.
 */
export function resolve(language: AppLanguage, key: string): string {
  const hit = lookup(CATALOGS[language] as CatalogNode, key);
  if (hit !== undefined) return hit;
  const fallback = lookup(ko as CatalogNode, key);
  if (fallback !== undefined) {
    if (import.meta.env.DEV) console.warn(`[i18n] missing ${language} message: ${key}`);
    return fallback;
  }
  if (import.meta.env.DEV) console.warn(`[i18n] unknown message key: ${key}`);
  return key;
}

/** Substitute `{placeholder}` slots. Unknown placeholders are left untouched. */
export function interpolate(message: string, vars?: MessageVars): string {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (full, name: string) =>
    name in vars ? String(vars[name]) : full,
  );
}

/** Look up and format a message in one step. */
export function translate(language: AppLanguage, key: string, vars?: MessageVars): string {
  return interpolate(resolve(language, key), vars);
}

/** A message split into plain runs and the `<s>`-marked emphasised runs. */
export interface MessagePart {
  text: string;
  strong: boolean;
}

/**
 * Split a formatted message on its `<s>…</s>` emphasis markers.
 *
 * The designs emphasise a segment *inside* a sentence (the user's name on Home,
 * the call to action in the promo toast) and the segment sits at a different
 * position in each language, so the marker travels with the message rather than
 * being hardcoded around a placeholder in JSX.
 */
export function parts(message: string): MessagePart[] {
  const out: MessagePart[] = [];
  const re = /<s>([\s\S]*?)<\/s>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    if (m.index > last) out.push({ text: message.slice(last, m.index), strong: false });
    out.push({ text: m[1], strong: true });
    last = m.index + m[0].length;
  }
  if (last < message.length) out.push({ text: message.slice(last), strong: false });
  return out;
}

/** Strip emphasis markers — for `aria-label`, `title`, and other plain-text sinks. */
export function plain(message: string): string {
  return message.replace(/<\/?s>/g, "");
}
