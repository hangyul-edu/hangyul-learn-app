import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, STARTUP_TIMEOUT_MS, sessionIdOf, useAuth } from "./auth";
import { http } from "../lib/http";
import { loadSession, saveSession } from "../lib/storage";

/** An unsigned JWT-shaped token carrying just the claims the client reads. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64(claims)}.sig`;
}

function res(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
    json: async () => body,
  };
}

function Status() {
  return <p>{useAuth().status}</p>;
}

describe("sessionIdOf", () => {
  it("reads the sid claim of a JWT", () => {
    expect(sessionIdOf(jwt({ sid: "sess_1", jti: "x" }))).toBe("sess_1");
  });
  it("returns null for anything that is not a readable JWT", () => {
    expect(sessionIdOf("opaque-token")).toBeNull();
    expect(sessionIdOf("a.@@@.c")).toBeNull();
    expect(sessionIdOf(jwt({ jti: "x" }))).toBeNull();
  });
});

describe("AuthProvider with a session shared across tabs", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const first = { access: jwt({ sid: "s1", jti: "a1" }), refresh: jwt({ sid: "s1", jti: "r1" }) };

  beforeEach(() => {
    localStorage.clear();
    saveSession({ accessToken: first.access, refreshToken: first.refresh, accessExpiresAt: 0, autoLogin: true });
    fetchMock = vi.fn(async () => res(200, { user_id: "u1", nickname: "n" }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function mount(expected = "signed-in") {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Status />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText(expected);
  }

  it("keeps the session and offers a retry when the cold-start profile load cannot reach the server", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await mount("unreachable");
    expect(loadSession()?.refreshToken).toBe(first.refresh);
    // Still held in memory too: the next request goes out with it.
    fetchMock.mockImplementation(async () => res(200, { user_id: "u1", nickname: "n" }));
    await http.get("/users/me");
    expect(lastBearer()).toBe(`Bearer ${first.access}`);
  });

  it("keeps the session and offers a retry when the server fails", async () => {
    fetchMock.mockImplementation(async () => res(503, { code: "unavailable" }));
    await mount("unreachable");
    expect(loadSession()?.refreshToken).toBe(first.refresh);
  });

  it("clears the stored session when cold start finds it rejected", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes("/auth/token/refresh")
        ? res(401, { code: "invalid_refresh_token" })
        : res(401, { code: "invalid_token" }),
    );
    await mount("signed-out");
    expect(loadSession()).toBeNull();
  });

  // A stored access token has usually expired by the next launch: the
  // profile load is refused, the pair is refreshed, and the retry answers.
  // Refreshing replaced the session held in memory, and the launch check
  // took that for a different sign-in and dropped the answer — the app
  // stayed on the splash screen until a reload.
  it("signs in when the launch check has to refresh an expired access token", async () => {
    const refreshed = { access_token: jwt({ sid: "s1", jti: "a2" }), refresh_token: jwt({ sid: "s1", jti: "r2" }), expires_in: 900 };
    fetchMock.mockImplementation(async (url: string, init: { headers: Record<string, string> }) => {
      if (String(url).includes("/auth/token/refresh")) return res(200, refreshed);
      return init.headers.authorization === `Bearer ${refreshed.access_token}`
        ? res(200, { user_id: "u1", nickname: "n" })
        : res(401, { code: "token_expired" });
    });
    await mount();
    expect(loadSession()?.refreshToken).toBe(refreshed.refresh_token);
  });

  it("signs in when another tab rotated the pair during the launch check", async () => {
    const rotated = { access: jwt({ sid: "s1", jti: "a2" }), refresh: jwt({ sid: "s1", jti: "r2" }) };
    fetchMock.mockImplementation(async (_url: string, init: { headers: Record<string, string> }) => {
      if (init.headers.authorization === `Bearer ${rotated.access}`) return res(200, { user_id: "u1", nickname: "n" });
      // The other tab rotates while this tab's request is out.
      saveSession({ accessToken: rotated.access, refreshToken: rotated.refresh, accessExpiresAt: 0, autoLogin: true });
      return res(401, { code: "token_expired" });
    });
    await mount();
  });

  function lastBearer(): string | undefined {
    const init = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as { headers: Record<string, string> };
    return init.headers.authorization;
  }

  it("adopts a pair another tab rotated for the same session", async () => {
    await mount();
    const rotated = { access: jwt({ sid: "s1", jti: "a2" }), refresh: jwt({ sid: "s1", jti: "r2" }) };
    saveSession({ accessToken: rotated.access, refreshToken: rotated.refresh, accessExpiresAt: 0, autoLogin: true });

    await http.get("/users/me");

    expect(lastBearer()).toBe(`Bearer ${rotated.access}`);
  });

  it("does not switch to a different account's session stored by another tab", async () => {
    await mount();
    const other = { access: jwt({ sid: "s2", jti: "a9" }), refresh: jwt({ sid: "s2", jti: "r9" }) };
    saveSession({ accessToken: other.access, refreshToken: other.refresh, accessExpiresAt: 0, autoLogin: true });

    await http.get("/users/me");

    expect(lastBearer()).toBe(`Bearer ${first.access}`);
    expect(loadSession()?.refreshToken).toBe(other.refresh);
  });
});

describe("AuthProvider when a sign-in finishes during the cold-start check", () => {
  // Returning from a social provider reloads the app with the previous session
  // still stored; the completion screen applies the new one while the launch
  // check of the old session is in flight. When that old check then failed,
  // it wiped the new session from memory: every next request went out without
  // a token and the phone step answered "Please sign in again".
  const old = { access: jwt({ sid: "s-old", jti: "a1" }), refresh: jwt({ sid: "s-old", jti: "r1" }) };
  const fresh = { access_token: jwt({ sid: "s-new", jti: "a2" }), refresh_token: jwt({ sid: "s-new", jti: "r2" }), expires_in: 900 };
  let releaseOld: (r: ReturnType<typeof res>) => void = () => {};
  let fetchMock: ReturnType<typeof vi.fn>;

  function Probe() {
    const { status, applyTokens, bootstrapMe, me } = useAuth();
    return (
      <>
        <p>{status}</p>
        <p>{me ? `me:${(me as { user_id: string }).user_id}` : "me:none"}</p>
        <button
          onClick={async () => {
            applyTokens(fresh, true);
            await bootstrapMe();
          }}
        >
          complete
        </button>
      </>
    );
  }

  beforeEach(() => {
    localStorage.clear();
    saveSession({ accessToken: old.access, refreshToken: old.refresh, accessExpiresAt: 0, autoLogin: true });
    fetchMock = vi.fn(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
      if (String(url).includes("/auth/token/refresh")) {
        // Only the new session can still be refreshed.
        return JSON.parse(init.body ?? "{}").refresh_token === fresh.refresh_token
          ? res(200, fresh)
          : res(401, { code: "invalid_refresh_token" });
      }
      return init.headers.authorization === `Bearer ${old.access}`
        ? new Promise((resolve) => {
            releaseOld = resolve;
          })
        : res(200, { user_id: "u-new", nickname: "new" });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it.each([
    ["the server fails", 500],
    ["the old session is refused", 401],
  ])("keeps the new session when %s", async (_label, status) => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
    screen.getByText("complete").click();
    expect(await screen.findByText("me:u-new")).toBeInTheDocument();

    releaseOld(res(status, { code: status === 401 ? "unauthorized" : "internal_error" }));
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.getByText("signed-in")).toBeInTheDocument();
    expect(screen.getByText("me:u-new")).toBeInTheDocument();
    expect(loadSession()?.accessToken).toBe(fresh.access_token);
    await http.get("/users/me");
    const init = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1] as { headers: Record<string, string> };
    expect(init.headers.authorization).toBe(`Bearer ${fresh.access_token}`);
  });
});

describe("AuthProvider when the launch check gets no answer", () => {
  const stored = { access: jwt({ sid: "s1", jti: "a1" }), refresh: jwt({ sid: "s1", jti: "r1" }) };
  type Pending = { url: string; signal?: AbortSignal; resolve: (r: ReturnType<typeof res>) => void };
  let pending: Pending[];
  let fetchMock: ReturnType<typeof vi.fn>;

  function Probe() {
    const { status, me, retryStartup, applyTokens, bootstrapMe } = useAuth();
    return (
      <>
        <p>{status}</p>
        <p>{me ? `me:${(me as { user_id: string }).user_id}` : "me:none"}</p>
        <button onClick={retryStartup}>retry</button>
        <button
          onClick={async () => {
            applyTokens({ access_token: jwt({ sid: "s-new", jti: "a9" }), refresh_token: jwt({ sid: "s-new", jti: "r9" }), expires_in: 900 }, true);
            await bootstrapMe();
          }}
        >
          complete
        </button>
      </>
    );
  }

  /** Every request hangs until the test answers it. */
  function stallEverything() {
    fetchMock.mockImplementation(
      (url: string, init: { signal?: AbortSignal }) =>
        new Promise((resolve) => pending.push({ url: String(url), signal: init.signal, resolve })),
    );
  }

  async function mount() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );
  }

  async function wait(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.clear();
    saveSession({ accessToken: stored.access, refreshToken: stored.refresh, accessExpiresAt: 0, autoLogin: true });
    pending = [];
    fetchMock = vi.fn();
    stallEverything();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("waits on the splash until the timeout, then offers a retry and keeps the session", async () => {
    await mount();
    await wait(STARTUP_TIMEOUT_MS - 1000);
    expect(screen.getByText("booting")).toBeInTheDocument();

    await wait(1000);
    expect(screen.getByText("unreachable")).toBeInTheDocument();
    // The stalled profile request is cancelled; the session is untouched.
    expect(pending[pending.length - 1].signal?.aborted).toBe(true);
    expect(loadSession()?.refreshToken).toBe(stored.refresh);
    expect(loadSession()?.accessToken).toBe(stored.access);
  });

  it("signs in when a retry gets an answer", async () => {
    await mount();
    await wait(STARTUP_TIMEOUT_MS);
    expect(screen.getByText("unreachable")).toBeInTheDocument();

    fetchMock.mockImplementation(async () => res(200, { user_id: "u1", nickname: "n" }));
    act(() => screen.getByText("retry").click());
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(screen.getByText("me:u1")).toBeInTheDocument();
  });

  it("shows the splash again while a retry runs, and times that attempt out too", async () => {
    await mount();
    await wait(STARTUP_TIMEOUT_MS);
    act(() => screen.getByText("retry").click());
    expect(screen.getByText("booting")).toBeInTheDocument();
    await wait(STARTUP_TIMEOUT_MS);
    expect(screen.getByText("unreachable")).toBeInTheDocument();
  });

  it("ignores a late answer to an attempt that already timed out", async () => {
    await mount();
    await wait(STARTUP_TIMEOUT_MS);
    const timedOut = pending[pending.length - 1];
    act(() => screen.getByText("retry").click());
    const retried = pending[pending.length - 1];
    expect(retried).not.toBe(timedOut);

    // The first attempt's answer arrives during the retry: nothing changes.
    await act(async () => timedOut.resolve(res(200, { user_id: "u-late", nickname: "late" })));
    await wait(10);
    expect(screen.getByText("booting")).toBeInTheDocument();
    expect(screen.getByText("me:none")).toBeInTheDocument();

    await act(async () => retried.resolve(res(200, { user_id: "u1", nickname: "n" })));
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(screen.getByText("me:u1")).toBeInTheDocument();
  });

  it("does not sign out on a late refusal for an attempt that already timed out", async () => {
    await mount();
    await wait(STARTUP_TIMEOUT_MS);
    const timedOut = pending[pending.length - 1];
    await act(async () => timedOut.resolve(res(403, { code: "forbidden" })));
    await wait(10);
    expect(screen.getByText("unreachable")).toBeInTheDocument();
    expect(loadSession()?.refreshToken).toBe(stored.refresh);
  });

  it("keeps a stalled token refresh running and lets the retry use its answer", async () => {
    // The stored access token has expired: the profile load is refused and a
    // refresh starts, which then hangs.
    const refreshed = { access_token: jwt({ sid: "s1", jti: "a2" }), refresh_token: jwt({ sid: "s1", jti: "r2" }), expires_in: 900 };
    fetchMock.mockImplementation((url: string, init: { headers: Record<string, string>; signal?: AbortSignal }) => {
      if (String(url).includes("/auth/token/refresh")) {
        return new Promise((resolve) => pending.push({ url: String(url), signal: init.signal, resolve }));
      }
      return Promise.resolve(
        init.headers.authorization === `Bearer ${refreshed.access_token}`
          ? res(200, { user_id: "u1", nickname: "n" })
          : res(401, { code: "token_expired" }),
      );
    });
    await mount();
    await wait(STARTUP_TIMEOUT_MS);
    expect(screen.getByText("unreachable")).toBeInTheDocument();
    const refreshCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).includes("/auth/token/refresh")).length;
    expect(refreshCalls()).toBe(1);
    // Not cancelled: the server may already have rotated the single-use token.
    expect(pending[0].signal?.aborted ?? false).toBe(false);

    // The retry joins the refresh still in flight rather than spending the
    // same refresh token a second time.
    act(() => screen.getByText("retry").click());
    await wait(10);
    expect(refreshCalls()).toBe(1);
    await act(async () => pending[0].resolve(res(200, refreshed)));
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    expect(loadSession()?.refreshToken).toBe(refreshed.refresh_token);
  });

  it("keeps a social sign-in that finishes while the launch check is stalled", async () => {
    await mount();
    // The completion screen applies the new session; its own requests answer.
    fetchMock.mockImplementation((_url: string, init: { headers: Record<string, string> }) =>
      init.headers.authorization === `Bearer ${stored.access}`
        ? new Promise(() => {})
        : Promise.resolve(res(200, { user_id: "u-new", nickname: "new" })),
    );
    act(() => screen.getByText("complete").click());
    expect(await screen.findByText("me:u-new")).toBeInTheDocument();

    // The stale launch check times out afterwards: it must not show the error over the new sign-in.
    await wait(STARTUP_TIMEOUT_MS);
    expect(screen.getByText("signed-in")).toBeInTheDocument();
    expect(screen.getByText("me:u-new")).toBeInTheDocument();
  });
});

describe("AuthProvider when two launch checks overlap", () => {
  // StrictMode (and any remount) runs the launch check twice. The first
  // check's answer must not land on top of the second's.
  const stored = { access: jwt({ sid: "s1", jti: "a1" }), refresh: jwt({ sid: "s1", jti: "r1" }) };

  beforeEach(() => {
    localStorage.clear();
    saveSession({ accessToken: stored.access, refreshToken: stored.refresh, accessExpiresAt: 0, autoLogin: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("keeps the newer check's sign-in when the older one fails afterwards", async () => {
    let failFirst: () => void = () => {};
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        calls += 1;
        if (calls === 1) return new Promise((_resolve, reject) => (failFirst = () => reject(new TypeError("Failed to fetch"))));
        return Promise.resolve(res(200, { user_id: "u1", nickname: "n" }));
      }),
    );
    render(
      <StrictMode>
        <QueryClientProvider client={new QueryClient()}>
          <AuthProvider>
            <Status />
          </AuthProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
    expect(await screen.findByText("signed-in")).toBeInTheDocument();
    await act(async () => failFirst());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByText("signed-in")).toBeInTheDocument();
  });
});
