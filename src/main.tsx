import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./lib/http";
import { bootChannelTalk } from "./lib/channelTalk";
import { ToastProvider } from "./hooks/toast";
import { AuthProvider } from "./hooks/auth";
import { I18nProvider } from "./i18n";
import { App } from "./App";
import "./styles/theme.css";
import "./styles/global.css";

// Static hosts that fall back to index.html for unknown paths serve the
// MEMBER bundle for /admin/*. Hand such requests to the admin entry file
// (a real file on every host), carrying the deep link along as a query
// param the admin bootstrap restores.
function redirectToAdminApp(): boolean {
  const path = window.location.pathname;
  if (path !== "/admin" && !path.startsWith("/admin/")) return false;
  const rest = path.slice("/admin".length) + window.location.search;
  window.location.replace(`/admin.html${rest ? `?path=${encodeURIComponent(rest)}` : ""}`);
  return true;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => {
        // Never retry auth/validation errors; retry transient ones twice.
        if (err instanceof ApiError && err.status < 500 && err.status !== 429) return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

if (!redirectToAdminApp()) {
  // Boot the ChannelTalk web SDK when configured (VITE_CHANNEL_TALK_PLUGIN_KEY);
  // no-op otherwise. The FAQ support button opens the messenger via this SDK.
  bootChannelTalk();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        {/* i18n wraps auth: the profile only seeds the language, so the provider
            must already exist when <AuthProvider> resolves /users/me. */}
        <I18nProvider>
          <ToastProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}
