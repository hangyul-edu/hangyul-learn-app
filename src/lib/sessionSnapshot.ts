/**
 * Resume state for an in-progress study session.
 *
 * A learner who refreshes mid-session must come back to the same questions at
 * the same position — never to a freshly generated set. Each session screen
 * keeps a snapshot under its own key, scoped to the browser tab
 * (sessionStorage) and cleared when the session is finished or exited.
 *
 * Persistence is best-effort: a full or unavailable store must never break a
 * session, so a failed read or write is treated as "nothing to resume".
 */
export type SessionSnapshotStore<TSnapshot> = {
  /** The saved session, or null when there is nothing usable to resume. */
  read: () => TSnapshot | null;
  save: (snapshot: TSnapshot) => void;
  clear: () => void;
};

export function createSessionSnapshotStore<TSnapshot>(
  storageKey: string,
  /** Rejects a snapshot that would resume into an unusable state. */
  isResumable: (snapshot: TSnapshot) => boolean,
): SessionSnapshotStore<TSnapshot> {
  return {
    read: () => {
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (!stored) return null;
        const snapshot = JSON.parse(stored) as TSnapshot;
        return isResumable(snapshot) ? snapshot : null;
      } catch {
        return null;
      }
    },
    save: (snapshot) => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
      } catch {
        /* ignore quota / serialization errors */
      }
    },
    clear: () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    },
  };
}
