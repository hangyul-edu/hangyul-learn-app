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
