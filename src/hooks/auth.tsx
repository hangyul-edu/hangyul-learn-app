import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { http, setAuthHandlers } from "../lib/http";
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

  async function logout() {
    const refresh = sessionRef.current?.refreshToken;
    try {
      if (refresh) await http.post("/auth/logout", { refresh_token: refresh });
    } catch {
      /* ignore — we sign out locally regardless */
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

  const value = useMemo<AuthCtx>(
    () => ({ status, me, applyTokens, bootstrapMe, setMe, logout, hardSignOut }),
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
