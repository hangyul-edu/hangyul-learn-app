import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./lib/http";
import { bootChannelTalk } from "./lib/channelTalk";
import { ToastProvider } from "./hooks/toast";
import { AuthProvider } from "./hooks/auth";
import { App } from "./App";
import "./styles/theme.css";
import "./styles/global.css";

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

// Boot the ChannelTalk web SDK when configured (VITE_CHANNEL_TALK_PLUGIN_KEY);
// no-op otherwise. The FAQ support button opens the messenger via this SDK.
bootChannelTalk();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
