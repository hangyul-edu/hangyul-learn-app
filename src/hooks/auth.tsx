import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http, setAuthHandlers, ApiError, NetworkError } from "../lib/http";
import { gameApi } from "../api/endpoints";
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

  // Wire the http layer to this provider's session (token read + refresh + expiry).
  useEffect(() => {
    setAuthHandlers({
      getAccessToken: () => sessionRef.current?.accessToken ?? null,
      getRefreshToken: () => sessionRef.current?.refreshToken ?? null,
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

  // Daily attendance check-in: opening the app while signed in marks the user
  // present and awards attendance points. Fire once per signed-in session
  // (cold-start auto-login OR a fresh login). The server records attendance and
  // awards points idempotently per local day, so calling on every app open is
  // safe — a repeat call the same day is a no-op. Fire-and-forget: a failure
  // must never disrupt app usage (it retries on the next open). On a fresh
  // award, refresh the points/streak/league/notification views so the new
  // points show immediately.
  const checkedInRef = useRef(false);
  useEffect(() => {
    if (status !== "signed-in") {
      checkedInRef.current = false; // let the next sign-in check in again
      return;
    }
    if (checkedInRef.current) return;
    checkedInRef.current = true;
    (async () => {
      try {
        const res = await gameApi.checkIn();
        if (res?.points_awarded && res.points_awarded > 0) {
          for (const key of [
            ["dashboard"],
            ["streak"],
            ["points"],
            ["league-me"],
            ["league-season"],
            ["league-rankings"],
            ["notif-unread"],
          ]) {
            qc.invalidateQueries({ queryKey: key });
          }
        }
      } catch {
        /* non-critical — attendance retries on the next app open */
      }
    })();
  }, [status, qc]);

  const value = useMemo<AuthCtx>(
    () => ({ status, me, applyTokens, bootstrapMe, setMe, revokeSession, logout, hardSignOut }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, me],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
