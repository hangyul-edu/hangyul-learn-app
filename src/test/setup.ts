import "@testing-library/jest-dom/vitest";

// The react-router *data* router (createMemoryRouter, needed to exercise
// useBlocker) builds a `new Request(url, { signal })` for every navigation.
// Under jsdom, the global AbortSignal isn't accepted by Node's undici Request,
// which throws. No real network happens in tests (the API layer is mocked), so
// a permissive Request stand-in is sufficient and unblocks router navigation.
class TestRequest {
  url: string;
  method: string;
  signal: unknown;
  headers = new Headers();
  constructor(input: unknown, init: { method?: string; signal?: unknown } = {}) {
    this.url = typeof input === "string" ? input : (input as { url?: string })?.url ?? "";
    this.method = init.method ?? "GET";
    this.signal = init.signal;
  }
  clone() {
    return this;
  }
}
globalThis.Request = TestRequest as unknown as typeof Request;
