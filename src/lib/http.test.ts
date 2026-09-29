import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, NetworkError, http, setAuthHandlers } from "./http";

/** Minimal Response-shaped stub (the request layer only reads these fields). */
function res(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
    json: async () => body,
  };
}

const unauthorized = () => res(401, { code: "invalid_token", detail: "Token expired." });

/** A session held the way the providers hold it: a mutable pair plus callbacks. */
function session(access: string, refresh: string) {
  const s = {
    access,
    refresh,
    onExpired: vi.fn(),
    onRefreshed: vi.fn((a: string, r: string) => {
      s.access = a;
      s.refresh = r;
    }),
  };
  setAuthHandlers({
    getAccessToken: () => s.access,
    getRefreshToken: () => s.refresh,
    onRefreshed: s.onRefreshed,
    onExpired: s.onExpired,
  });
  return s;
}

function isRefresh(url: unknown) {
  return String(url).includes("/auth/token/refresh");
}

function bearer(init: unknown) {
  return (init as { headers: Record<string, string> }).headers.authorization;
}

describe("apiFetch token refresh", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes once on 401 and retries with the new access token", async () => {
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (isRefresh(url)) return res(200, { access_token: "a2", refresh_token: "r2", expires_in: 1800 });
      return bearer(init) === "Bearer a2" ? res(200, { ok: true }) : unauthorized();
    });

    await expect(http.get("/users/me")).resolves.toEqual({ ok: true });
    expect(s.onRefreshed).toHaveBeenCalledWith("a2", "r2", 1800);
    expect(s.onExpired).not.toHaveBeenCalled();
  });

  it("signs out when the server rejects the refresh token", async () => {
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string) =>
      isRefresh(url) ? res(401, { code: "invalid_refresh_token" }) : unauthorized(),
    );

    await expect(http.get("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(s.onExpired).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh call cannot reach the server", async () => {
    // A dropped connection says nothing about the refresh token. Signing out
    // here would throw away a valid 30-day session over a network blip.
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string) => {
      if (isRefresh(url)) throw new TypeError("Failed to fetch");
      return unauthorized();
    });

    await expect(http.get("/users/me")).rejects.toBeInstanceOf(NetworkError);
    expect(s.onExpired).not.toHaveBeenCalled();
  });

  it("keeps the session when the refresh endpoint fails with a server error", async () => {
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string) =>
      isRefresh(url) ? res(503, { code: "http_503", detail: "down" }) : unauthorized(),
    );

    const err = await http.get("/users/me").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(503);
    expect(s.onExpired).not.toHaveBeenCalled();
  });

  it("does not spend the refresh token when the 401 came from an already-replaced access token", async () => {
    // Refresh tokens are single-use. A request that left with the old access
    // token and came back 401 after another call already refreshed only needs
    // a retry with the current token.
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (isRefresh(url)) return res(401, { code: "invalid_refresh_token" });
      if (bearer(init) === "Bearer a1") {
        // Another request refreshed while this one was in flight.
        s.access = "a2";
        s.refresh = "r2";
        return unauthorized();
      }
      return res(200, { ok: true });
    });

    await expect(http.get("/users/me")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.some(([url]) => isRefresh(url))).toBe(false);
    expect(s.onExpired).not.toHaveBeenCalled();
  });

  it("retries instead of signing out when the refresh token was rotated elsewhere meanwhile", async () => {
    // Two tabs share one stored session. When both refresh with the same
    // token, the loser's token is already rotated — but the winner's new pair
    // is now the current session, so the request can simply be retried.
    const s = session("a1", "r1");
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (isRefresh(url)) {
        s.access = "a2";
        s.refresh = "r2";
        return res(401, { code: "invalid_refresh_token" });
      }
      return bearer(init) === "Bearer a2" ? res(200, { ok: true }) : unauthorized();
    });

    await expect(http.get("/users/me")).resolves.toEqual({ ok: true });
    expect(s.onExpired).not.toHaveBeenCalled();
  });
});
