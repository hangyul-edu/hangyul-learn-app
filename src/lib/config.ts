/**
 * Resolve the API base URL.
 * - Production: set VITE_API_BASE_URL to the backend origin.
 * - Development: leave it empty → "/api", which the Vite dev server proxies to
 *   the backend (vite.config.ts), so the browser never makes a cross-origin call.
 */
const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
export const API_BASE_URL = raw ? raw.replace(/\/+$/, "") : "/api";

export const APP_NAME = "한귤";
