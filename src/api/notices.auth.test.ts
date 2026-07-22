import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAuthHandlers } from "../lib/http";
import { supportApi } from "./endpoints";

/**
 * Regression guard for the root cause of "is_new never turns false":
 *
 * The per-user `is_new` flag only works if the member-facing notice requests
 * are AUTHENTICATED — otherwise the server can't attribute the read to a user
 * and falls back to the anonymous, age-only rule (always new within the
 * window). Mocked screen tests bypass `endpoints.ts`, so this exercises the
 * real request layer and asserts the bearer token is attached.
 */
describe("notice API requests carry the auth token", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAuthHandlers({
      getAccessToken: () => "test-access-token",
      getRefreshToken: () => null,
      onRefreshed: () => {},
      onExpired: () => {},
    });
    // Minimal response-shaped stub (avoids depending on a global Response ctor).
    const fakeRes = (status: number, jsonBody: unknown) => ({
      status,
      ok: status >= 200 && status < 300,
      text: async () => (jsonBody === undefined ? "" : JSON.stringify(jsonBody)),
    });
    fetchMock = vi.fn((url: string) =>
      String(url).includes("/read")
        ? Promise.resolve(fakeRes(204, undefined))
        : Promise.resolve(fakeRes(200, { items: [], next_cursor: null })),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function authHeader(call: unknown[]): string | undefined {
    const init = call[1] as { headers: Record<string, string> };
    return init.headers.authorization;
  }

  it("sends the bearer token on the notice list request", async () => {
    await supportApi.notices({ lang: "ko" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer test-access-token");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/support/notices");
  });

  it("sends the bearer token on the notice detail request", async () => {
    await supportApi.notice("n_a", "ko");
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer test-access-token");
  });

  it("sends an authenticated POST to the mark-as-read endpoint", async () => {
    await supportApi.markNoticeRead("n_a");
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string }];
    expect(String(url)).toContain("/support/notices/n_a/read");
    expect(init.method).toBe("POST");
    expect(authHeader(fetchMock.mock.calls[0])).toBe("Bearer test-access-token");
  });
});
