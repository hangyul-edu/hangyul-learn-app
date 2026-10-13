/**
 * Persisted auth session. Always kept in localStorage, so it is restored after a
 * reload or browser restart whether or not 자동 로그인 유지 was ticked: the
 * checkbox only changes the refresh token's server-side lifetime (30 days vs 1).
 */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** epoch ms when the access token expires. Informational only: nothing reads
   *  it — refresh is reactive, on a 401 (lib/http). */
  accessExpiresAt: number;
  /** The 자동 로그인 유지 choice at login. Recorded only; not read client-side. */
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
