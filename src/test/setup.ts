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

// This jsdom build exposes no Web Storage, so anything persisting state (the
// auth session, the language choice) would otherwise always take its failure
// path under test. A plain in-memory Storage keeps that behaviour exercisable.
// Production code still guards every access — storage is genuinely absent in
// private-mode browsers.
if (typeof globalThis.localStorage === "undefined") {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    key(i: number) {
      return [...this.store.keys()][i] ?? null;
    }
    getItem(k: string) {
      return this.store.get(k) ?? null;
    }
    setItem(k: string, v: string) {
      this.store.set(k, String(v));
    }
    removeItem(k: string) {
      this.store.delete(k);
    }
    clear() {
      this.store.clear();
    }
  }
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
}

// jsdom has no IntersectionObserver (used by infinite-scroll sentinels). A no-op
// stub is enough — tests drive pagination via the API mock, not real scrolling.
class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver = TestIntersectionObserver as unknown as typeof IntersectionObserver;
