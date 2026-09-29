import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http, setAuthHandlers, ApiError, NetworkError } from "../lib/http";
import { clearSession, loadSession, saveSession } from "../lib/storage";
import type { StoredSession } from "../lib/storage";
import type { Me, TokenResponse } from "../lib/types";

type Status = "booting" | "signed-out" | "signed-in";

interface AuthCtx {
  status: Status;
  me: Me | null;
  /** Store the token pair after a login/social/refresh flow. */
  applyTokens: (t: TokenResponse | { access_token: string; refresh_token: string; expires_in: number }, autoLogin: boolean) => void;
  /** Load /users/me and mark signed-in. Returns the profile. */
  bootstrapMe: () => Promise<Me>;
  setMe: (m: Me | ((prev: Me | null) => Me)) => void;
  /** Best-effort server-side session revocation only (no local sign-out). Lets a
   *  caller show a success step before clearing local state via hardSignOut. */
  revokeSession: () => Promise<void>;
  logout: () => Promise<void>;
  hardSignOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("booting");
  const [me, setMeState] = useState<Me | null>(null);
  const sessionRef = useRef<StoredSession | null>(loadSession());

  // The stored session is shared by every open tab, and refresh tokens are
  // single-use: once another tab rotates the pair, the copy held here is dead.
  // Adopt the stored pair when it is a newer pair for the SAME server session,
  // so this tab neither sends a revoked refresh token nor signs everyone out
  // after losing that race. A different session (another account signed in
  // elsewhere) is never adopted — this tab keeps acting as the user it shows.
  function currentSession(): StoredSession | null {
    const held = sessionRef.current;
    if (!held) return null;
    const stored = loadSession();
    if (stored && stored.refreshToken !== held.refreshToken) {
      const sid = sessionIdOf(held.refreshToken);
      if (sid !== null && sid === sessionIdOf(stored.refreshToken)) sessionRef.current = stored;
    }
    return sessionRef.current;
  }

  // Wire the http layer to this provider's session (token read + refresh + expiry).
  useEffect(() => {
    setAuthHandlers({
      getAccessToken: () => currentSession()?.accessToken ?? null,
      getRefreshToken: () => currentSession()?.refreshToken ?? null,
      onRefreshed: (access, refresh, expiresIn) => {
        if (!sessionRef.current) return;
        sessionRef.current = {
          ...sessionRef.current,
          accessToken: access,
          refreshToken: refresh,
          accessExpiresAt: Date.now() + expiresIn * 1000,
        };
        saveSession(sessionRef.current);
      },
      onExpired: () => hardSignOut(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyTokens(
    t: { access_token: string; refresh_token: string; expires_in: number },
    autoLogin: boolean,
  ) {
    const s: StoredSession = {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      accessExpiresAt: Date.now() + (t.expires_in ?? 1800) * 1000,
      autoLogin,
    };
    sessionRef.current = s;
    saveSession(s);
  }

  async function bootstrapMe(): Promise<Me> {
    const profile = await http.get<Me>("/users/me");
    setMeState(profile);
    setStatus("signed-in");
    return profile;
  }

  function setMe(m: Me | ((prev: Me | null) => Me)) {
    setMeState((prev) => (typeof m === "function" ? (m as (p: Me | null) => Me)(prev) : m));
  }

  function hardSignOut() {
    sessionRef.current = null;
    clearSession();
    setMeState(null);
    setStatus("signed-out");
    qc.clear();
  }

  // Server-side revocation only (no local sign-out). Resolves on success and on
  // a definitive 4xx (an already-invalid/expired session is effectively logged
  // out). THROWS only for temporary/retryable failures (5xx or network), so the
  // caller can keep the user signed in and surface a failure modal.
  async function revokeSession() {
    const refresh = sessionRef.current?.refreshToken;
    if (!refresh) return; // nothing to revoke → treat as done
    try {
      await http.post("/auth/logout", { refresh_token: refresh });
    } catch (e) {
      if (e instanceof NetworkError) throw e;
      if (e instanceof ApiError && e.status >= 500) throw e;
      /* 4xx / already-revoked → normalize as effectively logged out (done) */
    }
  }

  async function logout() {
    // Legacy always-sign-out path: revoke best-effort, sign out locally regardless.
    try {
      await revokeSession();
    } catch {
      /* ignore */
    }
    hardSignOut();
  }

  // Auto-login on cold start: if a stored session exists, try to load the profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionRef.current) {
        setStatus("signed-out");
        return;
      }
      try {
        const profile = await http.get<Me>("/users/me");
        if (!cancelled) {
          setMeState(profile);
          setStatus("signed-in");
        }
      } catch {
        if (!cancelled) hardSignOut();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daily attendance check-in + completion modal live in <AttendanceGate>,
  // mounted at the app root — it reads this provider's signed-in status.

  const value = useMemo<AuthCtx>(
    () => ({ status, me, applyTokens, bootstrapMe, setMe, revokeSession, logout, hardSignOut }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, me],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * The server session id (`sid` claim) a token belongs to, or null when the
 * token is not a readable JWT. Rotation keeps the sid, so two refresh tokens
 * with the same sid are successive pairs of one sign-in. Read without
 * verification — it only decides which of our own stored pairs is newer.
 */
export function sessionIdOf(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sid = (JSON.parse(json) as { sid?: unknown }).sid;
    return typeof sid === "string" ? sid : null;
  } catch {
    return null;
  }
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

/**
 * Non-throwing view of the auth context, for components that legitimately
 * render outside a provider (unauthenticated routes, isolated render tests).
 * Returns null there instead of blowing up. Use `useAuth` anywhere a session is
 * genuinely required.
 */
export function useAuthOptional(): AuthCtx | null {
  return useContext(Ctx) ?? null;
}
