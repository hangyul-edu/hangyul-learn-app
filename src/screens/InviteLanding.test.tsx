import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";

vi.mock("../api/endpoints", () => ({
  friendApi: { resolveInvitation: vi.fn(), request: vi.fn(), accept: vi.fn() },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

import { friendApi } from "../api/endpoints";
import { InviteLanding } from "./InviteLanding";

const api = friendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderInvite(token = "tok-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/friend/invite/${token}`]}>
          <Routes>
            <Route path="/friend/invite/:token" element={<InviteLanding />} />
            <Route path="/social" element={<div>SOCIAL</div>} />
            <Route path="/home" element={<div>HOME</div>} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.request.mockResolvedValue({ request_id: "r" });
  api.accept.mockResolvedValue({});
});

describe("InviteLanding", () => {
  it("resolves the token and lets the opener send a friend request", async () => {
    api.resolveInvitation.mockResolvedValue({
      inviter: { user_id: "u1", nickname: "Beam", profile_image_type: "NONE", relationship: "none" },
      is_self: false,
    });
    renderInvite();
    expect(await screen.findByText("Beam")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "친구 신청" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("u1"));
  });

  it("shows a friendly message for an invalid/expired token", async () => {
    api.resolveInvitation.mockRejectedValue(new Error("gone"));
    renderInvite("bad");
    expect(await screen.findByText("유효하지 않은 초대 링크예요")).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });
});
