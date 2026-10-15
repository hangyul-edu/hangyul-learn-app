import { API_BASE_URL } from "./config";
import { resolveMessage } from "../i18n/current";
import { apiErrorText, type ErrorAudience } from "../i18n/apiErrors";

/** One entry of a `validation_error` problem's `errors[]`: which field, never its value. */
export interface ApiFieldError {
  loc: (string | number)[];
  type?: string;
  msg?: string;
}

/**
 * Normalized API error. Carries the backend `code` (the real contract) + a friendly message.
 *
 * Built from the RESPONSE only. The request body is never attached to an error
 * (or logged anywhere in this module) — some bodies carry card numbers
 * (PCI DSS, docs/payments/09-security.md §9.1).
 */
export class ApiError extends Error {
  status: number;
  code: string;
  detail: string;
  /** Optional machine-readable context from the problem body (e.g. per-field messages). */
  details?: Record<string, unknown>;
  /** `errors[]` of a `validation_error`, reduced to `loc` / `type` / `msg`. */
  fieldErrors?: ApiFieldError[];
  constructor(
    status: number,
    code: string,
    detail: string,
    details?: Record<string, unknown>,
    fieldErrors?: ApiFieldError[],
  ) {
    super(detail || code || `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

/** Keep only where + why from a problem's `errors[]` (the server already drops `input`). */
function pickFieldErrors(raw: unknown): ApiFieldError[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((e): e is { loc: unknown[]; type?: unknown; msg?: unknown } => !!e && Array.isArray(e.loc))
    .map((e) => ({
      loc: e.loc.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
      type: typeof e.type === "string" ? e.type : undefined,
      msg: typeof e.msg === "string" ? e.msg : undefined,
    }));
}

export class NetworkError extends Error {
  constructor() {
    super("httpError.network");
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

/**
 * How a refresh attempt ended:
 * - `refreshed` — a new pair is stored; retry the request.
 * - `rejected` — the server refused the refresh token (unknown, rotated,
 *   revoked, session ended). Only this means the session is over.
 * - `unavailable` — the refresh never got an answer about the token (network
 *   failure, 5xx, rate limit). The session may be perfectly valid, so it is
 *   kept and `error` is surfaced instead.
 */
type RefreshOutcome =
  | { kind: "refreshed" }
  | { kind: "rejected" }
  | { kind: "unavailable"; error: Error };

// One refresh at a time: refresh tokens are single-use, so concurrent 401s
// must share a single rotation rather than race each other with the same token.
let refreshInFlight: Promise<RefreshOutcome> | null = null;

function refreshTokens(refreshToken: string): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<RefreshOutcome> => {
      try {
        let res: Response;
        try {
          res = await fetch(`${API_BASE_URL}/auth/token/refresh`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        } catch {
          return { kind: "unavailable", error: new NetworkError() };
        }
        if (res.status >= 500 || res.status === 429) {
          return { kind: "unavailable", error: new ApiError(res.status, `http_${res.status}`, "httpError.server") };
        }
        if (!res.ok) return { kind: "rejected" };
        const data = await res.json();
        handlers?.onRefreshed(data.access_token, data.refresh_token, data.expires_in ?? 1800);
        return { kind: "refreshed" };
      } finally {
        // Callers already hold this promise; later 401s start a new rotation
        // with whatever refresh token is current by then.
        refreshInFlight = null;
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
  /** "text" returns the raw body (e.g. a CSV download) instead of parsed JSON. */
  responseType?: "json" | "text";
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
  const { method = "GET", body, form, query, auth = true, _retry = false, signal, responseType = "json" } = opts;
  const headers: Record<string, string> = { accept: "application/json" };
  const sentToken = auth ? handlers?.getAccessToken() ?? null : null;
  if (sentToken) headers.authorization = `Bearer ${sentToken}`;
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
  const refreshToken = res.status === 401 && auth && !_retry ? handlers?.getRefreshToken() : null;
  if (handlers && refreshToken) {
    const retry = () => apiFetch<T>(path, { ...opts, _retry: true });
    // Another call already refreshed while this one was in flight: the 401 was
    // for the old access token, so retry rather than spend the new refresh token.
    if (handlers.getAccessToken() !== sentToken) return retry();
    const outcome = await refreshTokens(refreshToken);
    if (outcome.kind === "refreshed") return retry();
    if (outcome.kind === "unavailable") throw outcome.error;
    // Rejected — unless the stored pair changed meanwhile (another tab rotated
    // the same token first), in which case the current pair is still good.
    if (handlers.getRefreshToken() !== refreshToken) return retry();
    handlers.onExpired();
  }

  if (res.status === 204) return undefined as T;

  let data: any = null;
  const text = await res.text();
  if (res.ok && responseType === "text") return text as T;
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
    throw new ApiError(res.status, code, detail, data?.details, pickFieldErrors(data?.errors));
  }
  return data as T;
}

function friendlyFallback(status: number): string {
  if (status >= 500) return "httpError.server";
  if (status === 404) return "httpError.notFound";
  if (status === 403) return "httpError.forbidden";
  return "httpError.badRequest";
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
  /** multipart upload; POST unless `o.method` says otherwise (e.g. "PUT"). */
  upload: <T>(p: string, form: FormData, o?: RequestOptions) =>
    apiFetch<T>(p, { method: "POST", ...o, form }),
};

let errorAudience: ErrorAudience = "member";

/**
 * Word API errors for operators: the admin portal turns this on at startup
 * (with Korean as its language), so its errors come from the admin catalog
 * before the member one.
 */
export function setErrorAudience(audience: ErrorAudience): void {
  errorAudience = audience;
}

/**
 * Turn any thrown value into a user-friendly message in the active language.
 *
 * An API error shows the app's sentence for its `code` / `details.reason`
 * (i18n/apiErrors), never the server's English `detail`; a code the catalogs
 * don't know gets the generic message for its HTTP status. Anything else is
 * either one of our catalog keys (translated) or display text (passed through).
 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    return apiErrorText(e, { audience: errorAudience }) ?? resolveMessage(friendlyFallback(e.status));
  }
  if (e instanceof NetworkError) return resolveMessage(e.message);
  if (e instanceof Error && e.message) return resolveMessage(e.message);
  return resolveMessage("httpError.unknown");
}

/** The API answered 404: the thing asked for does not exist (or not for you). */
export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

/** react-query `retry`: up to two retries, none for a 404 (retrying cannot
 * make a missing item appear). */
export function retryUnlessNotFound(failureCount: number, error: unknown): boolean {
  return !isNotFound(error) && failureCount < 2;
}
