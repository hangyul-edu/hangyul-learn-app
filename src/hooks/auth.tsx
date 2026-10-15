import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http, setAuthHandlers, ApiError, NetworkError } from "../lib/http";
import { resetChannelTalkUser } from "../lib/channelTalk";
import { clearSession, loadSession, saveSession } from "../lib/storage";
import type { StoredSession } from "../lib/storage";
import type { Me, TokenResponse } from "../lib/types";

/**
 * - `booting` — the launch check of a stored session is running.
 * - `unreachable` — that check got no answer (timeout, offline, server
 *   error). The session is kept; `retryStartup` runs the check again.
 */
type Status = "booting" | "unreachable" | "signed-out" | "signed-in";

/** How long the launch check waits for an answer before offering a retry. */
export const STARTUP_TIMEOUT_MS = 15_000;

const TIMED_OUT = Symbol("timed out");

interface AuthCtx {
  status: Status;
  me: Me | null;
  /** Run the launch check again after it found the server unreachable. */
  retryStartup: () => void;
  /** Store the token pair after a login/social/refresh flow. */
  applyTokens: (t: TokenResponse | { access_token: string; refresh_token: string; expires_in: number }, autoLogin: boolean) => void;
  /** Load /users/me and mark signed-in. Returns the profile. */
  bootstrapMe: () => Promise<Me>;
  setMe: (m: Me | ((prev: Me | null) => Me)) => void;
  /** Best-effort server-side session revocation only (no local sign-out). Lets a
   *  caller show a success step before clearing local state via hardSignOut. */
  revokeSession: () => Promise<void>;
  hardSignOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("booting");
  const [me, setMeState] = useState<Me | null>(null);
  const sessionRef = useRef<StoredSession | null>(loadSession());
  // Counts sign-ins and sign-outs. Refreshing or adopting a rotated pair
  // replaces sessionRef.current but stays the same sign-in, so it is not
  // counted.
  const signInsRef = useRef(0);
  // Numbers the launch checks; only the latest one's answer is used.
  const startupRef = useRef(0);

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
    signInsRef.current += 1;
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
    signInsRef.current += 1;
    sessionRef.current = null;
    clearSession();
    setMeState(null);
    setStatus("signed-out");
    qc.clear();
    // The support messenger is still booted as this member; on a shared
    // device the next person would otherwise see their chats.
    resetChannelTalkUser();
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
      if (isTransient(e)) throw e;
      /* 4xx / already-revoked → normalize as effectively logged out (done) */
    }
  }

  // Auto-login on cold start: if a stored session exists, try to load the profile.
  async function startupCheck() {
    const attempt = ++startupRef.current;
    if (!sessionRef.current) {
      setStatus("signed-out");
      return;
    }
    setStatus("booting");
    // A sign-in can finish while this check is in flight — returning from a
    // social provider reloads the app with the previous session stored, and
    // the completion screen applies the new one. The answer then concerns a
    // session that is no longer ours: never sign out, or show, over it.
    // A refresh during the check (the stored access token has usually
    // expired by the next launch) is the same sign-in, and must not count.
    // A retry or unmount makes this attempt's answer stale too.
    const signIn = signInsRef.current;
    const current = () => startupRef.current === attempt && signInsRef.current === signIn;
    // Only the profile request is cancelled on timeout. A token refresh it
    // started keeps running: the server may already have rotated the
    // single-use refresh token, and only that answer carries the new one.
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), STARTUP_TIMEOUT_MS);
    });
    try {
      const answer = await Promise.race([http.get<Me>("/users/me", undefined, { signal: abort.signal }), timeout]);
      if (!current()) return;
      if (answer === TIMED_OUT) {
        setStatus("unreachable");
      } else {
        setMeState(answer);
        setStatus("signed-in");
      }
    } catch (e) {
      if (!current()) return;
      // Offline or the API is down: nothing is known to be wrong with the
      // stored session, so keep it and offer a retry instead of wiping a
      // long-lived auto-login over a failed request.
      if (isTransient(e)) setStatus("unreachable");
      else hardSignOut();
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  }

  useEffect(() => {
    void startupCheck();
    return () => {
      startupRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function retryStartup() {
    void startupCheck();
  }

  // Daily attendance check-in + completion modal live in <AttendanceGate>,
  // mounted at the app root — it reads this provider's signed-in status.

  const value = useMemo<AuthCtx>(
    () => ({ status, me, retryStartup, applyTokens, bootstrapMe, setMe, revokeSession, hardSignOut }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, me],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A failure that says nothing about the session itself: no answer, or a 5xx. */
function isTransient(e: unknown): boolean {
  return e instanceof NetworkError || (e instanceof ApiError && e.status >= 500);
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
