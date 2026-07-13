import { API_BASE_URL } from "./config";

/** Normalized API error. Carries the backend `code` (the real contract) + a friendly message. */
export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;
  constructor(status: number, code: string, detail: string) {
    super(detail || code || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("네트워크에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.");
    this.name = "NetworkError";
  }
}

/* ---- Auth bridge: the AuthProvider wires these so http can read/refresh tokens ---- */
interface AuthHandlers {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onRefreshed: (accessToken: string, refreshToken: string, expiresIn: number) => void;
  onExpired: () => void;
}
let handlers: AuthHandlers | null = null;
export function setAuthHandlers(h: AuthHandlers): void {
  handlers = h;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!handlers) return false;
  const refreshToken = handlers.getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/token/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        handlers!.onRefreshed(data.access_token, data.refresh_token, data.expires_in ?? 1800);
        return true;
      } catch {
        return false;
      } finally {
        // cleared after callers observe the result
        setTimeout(() => (refreshInFlight = null), 0);
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** multipart FormData body (skips JSON encoding). */
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean; // default true
  /** internal: prevents infinite refresh loops. */
  _retry?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(
    path.startsWith("http") ? path : API_BASE_URL + path,
    window.location.origin,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export async function apiFetch<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, form, query, auth = true, _retry = false, signal } = opts;
  const headers: Record<string, string> = { accept: "application/json" };
  if (auth && handlers) {
    const token = handlers.getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  let payload: BodyInit | undefined;
  if (form) {
    payload = form; // browser sets multipart boundary
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new NetworkError();
  }

  // Auto-refresh on 401 for authenticated calls (once).
  if (res.status === 401 && auth && !_retry && handlers?.getRefreshToken()) {
    const ok = await refreshTokens();
    if (ok) return apiFetch<T>(path, { ...opts, _retry: true });
    handlers?.onExpired();
  }

  if (res.status === 204) return undefined as T;

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!res.ok) {
    const code = data?.code || data?.title || "error";
    const detail = data?.detail || friendlyFallback(res.status);
    throw new ApiError(res.status, code, detail);
  }
  return data as T;
}

function friendlyFallback(status: number): string {
  if (status >= 500) return "일시적인 서버 오류예요. 잠시 후 다시 시도해 주세요.";
  if (status === 404) return "요청한 정보를 찾을 수 없어요.";
  if (status === 403) return "권한이 없어요.";
  return "요청을 처리하지 못했어요.";
}

export const http = {
  get: <T>(p: string, query?: RequestOptions["query"], o?: RequestOptions) =>
    apiFetch<T>(p, { ...o, method: "GET", query }),
  post: <T>(p: string, body?: unknown, o?: RequestOptions) =>
    apiFetch<T>(p, { ...o, method: "POST", body }),
  put: <T>(p: string, body?: unknown, o?: RequestOptions) =>
    apiFetch<T>(p, { ...o, method: "PUT", body }),
  patch: <T>(p: string, body?: unknown, o?: RequestOptions) =>
    apiFetch<T>(p, { ...o, method: "PATCH", body }),
  del: <T>(p: string, o?: RequestOptions) => apiFetch<T>(p, { ...o, method: "DELETE" }),
  upload: <T>(p: string, form: FormData, o?: RequestOptions) =>
    apiFetch<T>(p, { ...o, method: "POST", form }),
};

/** Turn any thrown value into a user-friendly message. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.detail;
  if (e instanceof NetworkError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return "알 수 없는 오류가 발생했어요.";
}
