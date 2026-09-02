import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Frontend unit/component test runner. Kept separate from vite.config.ts so the
// production build config stays untouched. jsdom + Testing Library; tests mock
// the network boundary (src/api) and never hit a real backend.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    css: false,
  },
});
