import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api → the backend so the browser never makes a
// cross-origin request in development (and cookies/headers "just work").
// The base URL used by the app is read from VITE_API_BASE_URL at build/runtime;
// when it is left empty the app talks to "/api" and relies on this proxy.
//
// The admin portal is not served here: it runs on its own server
// (hangyul-admin).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";
  requireApiUrlOnVercel(env);
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
    },
  };
});

/** On Vercel the API is another domain. Without its address the build would
 * fall back to "/api" on the app's own domain, where the SPA rewrite answers
 * every API call with index.html — so fail the build instead. */
function requireApiUrlOnVercel(env: Record<string, string>): void {
  if (!env.VERCEL) return;
  const url = (env.VITE_API_BASE_URL ?? "").trim();
  if (!/^https:\/\/[^/]/.test(url)) {
    throw new Error(
      `VITE_API_BASE_URL must be the API's https URL (e.g. https://api.example.com) in the Vercel project's ` +
        `environment variables; got ${url ? JSON.stringify(url) : "nothing"}.`,
    );
  }
}
