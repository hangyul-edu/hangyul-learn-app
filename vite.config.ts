import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server proxies /api → the backend so the browser never makes a
// cross-origin request in development (and cookies/headers "just work").
// The base URL used by the app is read from VITE_API_BASE_URL at build/runtime;
// when it is left empty the app talks to "/api" and relies on this proxy.
//
// The admin portal is not served here: it runs on its own server
// (hangyul-admin).
export default defineConfig(({ mode }) => {
  const backend = process.env.VITE_DEV_BACKEND || "http://127.0.0.1:8000";
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
