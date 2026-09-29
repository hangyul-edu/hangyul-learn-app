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

  async function mount() {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Status />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("signed-in");
  }

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
