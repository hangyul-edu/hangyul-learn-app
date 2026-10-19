import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";

vi.mock("../api/endpoints", () => ({
  friendApi: { resolveInvitation: vi.fn(), request: vi.fn(), accept: vi.fn() },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

import { friendApi } from "../api/endpoints";
import { InviteLanding } from "./InviteLanding";

const api = friendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderInvite(token = "tok-1", qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    // Assertions below are written against the Korean design frames.
    <I18nProvider language="ko">
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
      </QueryClientProvider>
    </I18nProvider>,
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
    // The same bottom notice as every other friend action.
    const notice = await screen.findByText("친구 신청을 보냈어요");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
  });

  it("accepting refreshes the friend lists the Social screen shows", async () => {
    // Regression: nothing was invalidated, so Social kept its pre-accept
    // friends / requests (and friend league) until the cache went stale.
    api.resolveInvitation.mockResolvedValue({
      inviter: { user_id: "u2", nickname: "Beam", profile_image_type: "NONE", relationship: "request_received", request_id: "r1" },
      is_self: false,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData(["friends"], { items: [] });
    qc.setQueryData(["friend-requests-received"], { items: [] });
    renderInvite("tok-1", qc);
    await userEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(qc.getQueryState(["friends"])?.isInvalidated).toBe(true));
    expect(qc.getQueryState(["friend-requests-received"])?.isInvalidated).toBe(true);
    // The named bottom notice (cp_G_03_toast), as everywhere a request is accepted.
    const notice = await screen.findByText("Beam님과 친구가 되었어요!");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
  });

  it("shows a friendly message for an invalid/expired token", async () => {
    api.resolveInvitation.mockRejectedValue(new Error("gone"));
    renderInvite("bad");
    expect(await screen.findByText("유효하지 않은 초대 링크예요")).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });
});
