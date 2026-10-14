import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, sessionIdOf, useAuth } from "./auth";
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

  it("keeps the stored session when the cold-start profile load cannot reach the server", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    await mount("signed-out");
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
