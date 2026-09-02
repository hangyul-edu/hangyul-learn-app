/**
 * Key/typing plumbing for the translation catalogs.
 *
 * `ko` is the reference catalog: it is the language the designs were authored
 * in, so every other locale is typed against its shape. Adding a key to `ko`
 * without adding it to `en` is a compile error, which is what keeps the two
 * Figma variants from drifting apart.
 */

/** A catalog is an arbitrarily nested tree of message strings. */
export interface CatalogNode {
  [key: string]: string | CatalogNode;
}

/**
 * Every leaf path of `T` as a dot-joined string literal, e.g. `"home.greeting"`.
 * Only leaves are produced, so `t("home")` — a branch — fails to compile.
 */
export type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];

/** Values substituted into `{placeholder}` slots. */
export type MessageVars = Record<string, string | number>;
