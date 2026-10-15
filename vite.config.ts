import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api → the backend so the browser never makes a
// cross-origin request in development (and cookies/headers "just work").
// The base URL used by the app is read from VITE_API_BASE_URL at build/runtime;
// when it is left empty the app talks to "/api" and relies on this proxy.
//
// The admin portal lives in its own repository (hangyul-admin) and dev server.
// /admin is passed through to it, so http://localhost:5173/admin keeps
// opening the portal next to the app during development.
export default defineConfig(({ mode }) => {
  const backend = process.env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";
  // "localhost", not 127.0.0.1: that is the name the portal's dev server
  // listens on, which may resolve to ::1 only.
  const admin = process.env.VITE_DEV_ADMIN || "http://localhost:5174";
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
        "^/admin(/|$)": {
          target: admin,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: mode !== "production",
    },
  };
});
