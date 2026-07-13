/** Persisted auth session. Kept in localStorage so "auto login" survives reloads. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires (used to refresh proactively). */
  accessExpiresAt: number;
  autoLogin: boolean;
}

const KEY = "hangyul.session.v1";

export function loadSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (!s.accessToken || !s.refreshToken) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: StoredSession): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}
