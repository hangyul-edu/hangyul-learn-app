import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";

vi.mock("../api/endpoints", () => ({
  gameApi: {},
  friendApi: {
    list: vi.fn(),
    received: vi.fn(),
    sent: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    cancel: vi.fn(),
    remove: vi.fn(),
    request: vi.fn(),
    searchPhone: vi.fn(),
  },
}));
let mockLang = "ko";
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: mockLang } }) }));

import { friendApi } from "../api/endpoints";
import { Social } from "./Social";

const api = friendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const friend = (id: string, nickname: string) => ({ user_id: id, nickname, profile_image_type: "NONE" as const });
const request = (rid: string, uid: string, nickname: string) => ({
  request_id: rid,
  user_id: uid,
  nickname,
  profile_image_type: "NONE" as const,
  created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  relative_time: "2h ago",
});

function renderSocial(initial = "/social") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={["/league", initial]} initialIndex={1}>
          <Routes>
            <Route path="/league" element={<div>LEAGUE_SCREEN</div>} />
            <Route path="/social" element={<Social />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLang = "ko";
  api.list.mockResolvedValue({ friends: [friend("f1", "Tara"), friend("f2", "Kai")], count: 2 });
  api.received.mockResolvedValue({ requests: [request("r1", "u1", "Hana")], count: 1 });
  api.sent.mockResolvedValue({ requests: [request("s1", "u2", "Yuki")], count: 1 });
  api.accept.mockResolvedValue({});
  api.reject.mockResolvedValue(undefined);
  api.cancel.mockResolvedValue(undefined);
  api.remove.mockResolvedValue(undefined);
});

describe("Friend Management (Social)", () => {
  it("renders the header, add-friend button, and tabs with backend counts", async () => {
    renderSocial();
    expect(screen.getByRole("heading", { name: "친구 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "뒤로 가기" })).toBeInTheDocument();
    // Tab counts come from each list's count field.
    expect(await screen.findByRole("tab", { name: "친구 2" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "받은 요청 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "보낸 요청 1" })).toBeInTheDocument();
    // Friends selected by default.
    expect(screen.getByRole("tab", { name: "친구 2" })).toHaveAttribute("aria-selected", "true");
  });

  it("returns to Friend League from the back button", async () => {
    renderSocial();
    await userEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(await screen.findByText("LEAGUE_SCREEN")).toBeInTheDocument();
  });

  it("renders friend rows with name + a delete pill", async () => {
    renderSocial();
    expect(await screen.findByText("Tara")).toBeInTheDocument();
    const row = screen.getByText("Tara").closest("li")!;
    expect(within(row).getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("shows the friends empty state with an add-friend action", async () => {
    api.list.mockResolvedValue({ friends: [], count: 0 });
    renderSocial();
    expect(await screen.findByText("아직 친구가 없어요")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "친구 추가" }).length).toBeGreaterThanOrEqual(1);
  });

  it("opens the friend-search flow from the add-friend button", async () => {
    renderSocial();
    await screen.findByText("Tara");
    await userEvent.click(screen.getByRole("button", { name: "친구 추가" }));
    expect(await screen.findByRole("button", { name: "검색" })).toBeInTheDocument();
  });

  it("received tab: shows requester, relative time, and orange Accept + Reject", async () => {
    renderSocial();
    await userEvent.click(await screen.findByRole("tab", { name: "받은 요청 1" }));
    expect(await screen.findByText("Hana")).toBeInTheDocument();
    const row = screen.getByText("Hana").closest("li")!;
    expect(within(row).getByText(/요청/)).toBeInTheDocument(); // relative age label
    const accept = within(row).getByRole("button", { name: "수락" });
    expect(accept).toHaveClass("fm__pill--primary"); // orange, prominent
    within(row).getByRole("button", { name: "거절" });
  });

  it("accepting a request calls the accept API", async () => {
    renderSocial();
    await userEvent.click(await screen.findByRole("tab", { name: "받은 요청 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith("r1"));
  });

  it("rejecting a request calls the reject API", async () => {
    renderSocial();
    await userEvent.click(await screen.findByRole("tab", { name: "받은 요청 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "거절" }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith("r1"));
  });

  it("sent tab: cancel calls the cancel API (not reject/remove)", async () => {
    renderSocial();
    await userEvent.click(await screen.findByRole("tab", { name: "보낸 요청 1" }));
    await userEvent.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("s1"));
    expect(api.reject).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it("delete opens a confirmation modal; cancel calls nothing, confirm removes the friend", async () => {
    renderSocial();
    await screen.findByText("Tara");
    const row = screen.getByText("Tara").closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "삭제" }));
    // Dynamic nickname + no-notification note.
    expect(await screen.findByText("Tara님을 친구에서 삭제할까요?")).toBeInTheDocument();
    expect(screen.getByText("상대방에게 알림은 가지 않습니다.")).toBeInTheDocument();

    // Cancel → no backend call, modal closes.
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(api.remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Tara님을 친구에서 삭제할까요?")).not.toBeInTheDocument());

    // Reopen and confirm → removes exactly that friend (scope to the modal,
    // since the row also has a 삭제 pill).
    await userEvent.click(within(screen.getByText("Tara").closest("li")!).getByRole("button", { name: "삭제" }));
    const modal = (await screen.findByText("Tara님을 친구에서 삭제할까요?")).closest(".dialog") as HTMLElement;
    await userEvent.click(within(modal).getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("f1"));
  });

  it("blocks duplicate taps on an action (only one request)", async () => {
    let resolve!: () => void;
    api.reject.mockReturnValue(new Promise<void>((r) => { resolve = () => r(); }));
    renderSocial();
    await userEvent.click(await screen.findByRole("tab", { name: "받은 요청 1" }));
    const reject = await screen.findByRole("button", { name: "거절" });
    await userEvent.click(reject);
    await userEvent.click(reject); // ignored (busy)
    expect(api.reject).toHaveBeenCalledTimes(1);
    expect(reject).toBeDisabled();
    resolve();
  });

  it("does not flash an empty state while loading", async () => {
    let resolve!: (v: unknown) => void;
    api.list.mockReturnValue(new Promise((r) => { resolve = r; }));
    renderSocial();
    expect(screen.queryByText("아직 친구가 없어요")).not.toBeInTheDocument();
    resolve({ friends: [friend("f1", "Tara")], count: 1 });
    expect(await screen.findByText("Tara")).toBeInTheDocument();
  });

  it("shows a retryable error when the friend list fails", async () => {
    api.list.mockRejectedValueOnce(new Error("boom"));
    renderSocial();
    const retry = await screen.findByRole("button", { name: "다시 시도" });
    api.list.mockResolvedValue({ friends: [friend("f1", "Tara")], count: 1 });
    await userEvent.click(retry);
    expect(await screen.findByText("Tara")).toBeInTheDocument();
  });

  it("renders English chrome for an English user", async () => {
    mockLang = "en";
    renderSocial();
    expect(screen.getByRole("heading", { name: "Manage Friends" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "Friends 2" })).toBeInTheDocument();
    await screen.findByText("Tara");
    await userEvent.click(within(screen.getByText("Tara").closest("li")!).getByRole("button", { name: "Remove" }));
    expect(await screen.findByText("Remove Tara from your friends?")).toBeInTheDocument();
    expect(screen.getByText("They will not be notified.")).toBeInTheDocument();
  });
});
