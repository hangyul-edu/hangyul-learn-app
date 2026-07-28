import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api → the backend so the browser never makes a
// cross-origin request in development (and cookies/headers "just work").
// The base URL used by the app is read from VITE_API_BASE_URL at build/runtime;
// when it is left empty the app talks to "/api" and relies on this proxy.
export default defineConfig(({ mode }) => {
  const backend = process.env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";
  return {
    plugins: [
      react(),
      {
        // Serve the admin SPA at /admin (and any /admin/* deep link) in both
        // `vite` (dev) and `vite preview`. Other static hosts need the same
        // rewrite — and the runtime redirect in src/main.tsx covers hosts
        // that only have an index.html fallback (see docs/admin-portal.md).
        name: "admin-spa-fallback",
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/admin" || req.url?.startsWith("/admin/")) {
              req.url = "/admin.html";
            }
            next();
          });
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === "/admin" || req.url?.startsWith("/admin/")) {
              req.url = "/admin.html";
            }
            next();
          });
        },
      },
    ],
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
      rollupOptions: {
        input: {
          main: new URL("./index.html", import.meta.url).pathname,
          admin: new URL("./admin.html", import.meta.url).pathname,
        },
      },
    },
  };
});
