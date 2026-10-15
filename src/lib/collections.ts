/** Immutable updates for state held in Sets and Records. */

/** A copy of `set` with `key` added (state updates never mutate). */
export function withKey<T>(set: Set<T>, key: T): Set<T> {
  return new Set(set).add(key);
}

/** A copy of `set` without `key`. */
export function withoutKey<T>(set: Set<T>, key: T): Set<T> {
  const next = new Set(set);
  next.delete(key);
  return next;
}

/** A copy of `record` without `key`. */
export function withoutEntry<V>(record: Record<string, V>, key: string): Record<string, V> {
  const next = { ...record };
  delete next[key];
  return next;
}

/** `items` without repeats of the same `key`, first occurrence kept (server
 * order preserved) — overlapping cursor pages never show an item twice. */
export function uniqueBy<T>(items: Iterable<T>, key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** Every item of a paged list, in page order, without repeats. */
export function flattenPages<T>(pages: { items: T[] }[] | undefined, key: (item: T) => string): T[] {
  return uniqueBy((pages ?? []).flatMap((p) => p.items), key);
}
