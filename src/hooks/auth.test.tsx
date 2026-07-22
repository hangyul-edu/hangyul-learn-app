import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/* -------------------------------- mocks --------------------------------- */
const { checkIn, httpGet } = vi.hoisted(() => ({ checkIn: vi.fn(), httpGet: vi.fn() }));

vi.mock("../api/endpoints", () => ({ gameApi: { checkIn } }));

let storedSession: unknown = null;
vi.mock("../lib/storage", () => ({
  loadSession: () => storedSession,
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock("../lib/http", () => ({
  http: { get: httpGet, post: vi.fn() },
  setAuthHandlers: vi.fn(),
  ApiError: class ApiError extends Error {},
  NetworkError: class NetworkError extends Error {},
}));

import { AuthProvider, useAuth } from "./auth";

function StatusProbe() {
  const { status } = useAuth();
  return <div>status:{status}</div>;
}

function renderAuth() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

const A_SESSION = {
  accessToken: "a",
  refreshToken: "r",
  accessExpiresAt: Date.now() + 1_000_000,
  autoLogin: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  storedSession = null;
  checkIn.mockResolvedValue({ points_awarded: 5, consecutive_days: 1 });
  httpGet.mockResolvedValue({ user_id: "u1", email: "a@b.com", name: "A", nickname: "A" });
});
afterEach(() => {
  storedSession = null;
});

describe("AuthProvider — daily attendance check-in on app open", () => {
  it("fires the attendance check-in once when a signed-in session is established", async () => {
    storedSession = A_SESSION;
    renderAuth();
    await screen.findByText("status:signed-in");
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
  });

  it("does not check in when there is no session (signed out)", async () => {
    storedSession = null;
    renderAuth();
    await screen.findByText("status:signed-out");
    await new Promise((r) => setTimeout(r, 0)); // let any effects settle
    expect(checkIn).not.toHaveBeenCalled();
  });

  it("does not disrupt sign-in when the check-in request fails", async () => {
    storedSession = A_SESSION;
    checkIn.mockRejectedValue(new Error("boom"));
    renderAuth();
    // Still becomes signed-in despite the failed (fire-and-forget) check-in.
    await screen.findByText("status:signed-in");
    await waitFor(() => expect(checkIn).toHaveBeenCalledTimes(1));
  });
});
