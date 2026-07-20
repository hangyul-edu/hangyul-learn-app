import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../hooks/toast";
import type { ReactNode } from "react";

vi.mock("../../api/endpoints", () => ({
  friendApi: {
    recommendations: vi.fn(),
    searchPhone: vi.fn(),
    request: vi.fn(),
    cancel: vi.fn(),
    accept: vi.fn(),
    reject: vi.fn(),
    getRequest: vi.fn(),
    createInvitation: vi.fn(),
  },
}));
let mockLang = "ko";
vi.mock("../../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: mockLang } }) }));

import { friendApi } from "../../api/endpoints";
import { AddFriendSheet, IncomingFriendRequestSheet } from "./AddFriendSheet";

const api = friendApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const rec = (
  user_id: string,
  nickname: string,
  relationship: string,
  request_id?: string,
) => ({ user_id, nickname, profile_image_type: "NONE" as const, relationship, request_id });

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>{node}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLang = "ko";
  api.recommendations.mockResolvedValue({ recommendations: [] });
  api.searchPhone.mockResolvedValue({ user: null });
  api.request.mockResolvedValue({ request_id: "new-req" });
  api.cancel.mockResolvedValue(undefined);
  api.accept.mockResolvedValue({});
  api.reject.mockResolvedValue(undefined);
  api.createInvitation.mockResolvedValue({ token: "tok-123" });
});

describe("AddFriendSheet", () => {
  it("renders the header, info box, and phone search field", async () => {
    wrap(<AddFriendSheet open onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "친구 추가" })).toBeInTheDocument();
    expect(screen.getByText("친구가 신청을 수락하면 서로 친구가 됩니다.")).toBeInTheDocument();
    expect(screen.getByText("친구는 내 리그 현황과 프로필을 볼 수 있습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("전화번호로 친구 찾기")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("전화번호로 찾기")).toBeInTheDocument();
  });

  it("closes via the X button", async () => {
    const onClose = vi.fn();
    wrap(<AddFriendSheet open onClose={onClose} />);
    await userEvent.click(await screen.findByRole("button", { name: "친구 추가 닫기" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps search disabled for invalid input and submits a hashed number", async () => {
    wrap(<AddFriendSheet open onClose={() => {}} />);
    const searchBtn = await screen.findByRole("button", { name: "검색" });
    expect(searchBtn).toBeDisabled(); // no digits yet

    await userEvent.type(screen.getByLabelText("전화번호로 친구 찾기"), "01012345678");
    expect(searchBtn).toBeEnabled();
    await userEvent.click(searchBtn);

    await waitFor(() => expect(api.searchPhone).toHaveBeenCalledTimes(1));
    const arg = api.searchPhone.mock.calls[0][0];
    // A SHA-256 hex digest — never the raw phone number.
    expect(arg).toMatch(/^[0-9a-f]{64}$/);
    expect(arg).not.toContain("010");
  });

  it("renders recommendations with the correct per-relationship action", async () => {
    api.recommendations.mockResolvedValue({
      recommendations: [
        rec("a", "Ann", "none"),
        rec("b", "Bob", "request_sent", "req-b"),
        rec("c", "Cara", "request_received", "req-c"),
        rec("d", "Dee", "friends"),
      ],
    });
    wrap(<AddFriendSheet open onClose={() => {}} />);

    const annRow = (await screen.findByText("Ann")).closest("li")!;
    expect(within(annRow).getByRole("button", { name: "친구 신청" })).toBeInTheDocument();
    const bobRow = screen.getByText("Bob").closest("li")!;
    expect(within(bobRow).getByRole("button", { name: "요청 취소" })).toBeInTheDocument();
    const caraRow = screen.getByText("Cara").closest("li")!;
    expect(within(caraRow).getByRole("button", { name: "수락" })).toBeInTheDocument();
    // Already friends → no request button.
    const deeRow = screen.getByText("Dee").closest("li")!;
    expect(within(deeRow).queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends exactly one request and blocks duplicate taps", async () => {
    let resolve!: () => void;
    api.request.mockReturnValue(new Promise<void>((r) => { resolve = () => r(); }));
    api.recommendations.mockResolvedValue({ recommendations: [rec("a", "Ann", "none")] });
    wrap(<AddFriendSheet open onClose={() => {}} />);

    const btn = await screen.findByRole("button", { name: "친구 신청" });
    await userEvent.click(btn);
    await userEvent.click(btn); // ignored (busy)
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request).toHaveBeenCalledWith("a");
    resolve();
  });

  it("cancels a pending outgoing request by its request id", async () => {
    api.recommendations.mockResolvedValue({ recommendations: [rec("b", "Bob", "request_sent", "req-b")] });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "요청 취소" }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("req-b"));
  });

  it("shows the no-recommendations panel and an invitation-link button", async () => {
    wrap(<AddFriendSheet open onClose={() => {}} />);
    expect(await screen.findByText("추천할 친구가 없어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "친구 신청 링크 공유하기" })).toBeInTheDocument();
  });

  it("copies the invitation link and shows the confirmation snackbar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    // The token is prefetched on open, so copying is instant on tap.
    await waitFor(() => expect(api.createInvitation).toHaveBeenCalled());
    await userEvent.click(await screen.findByRole("button", { name: "친구 신청 링크 공유하기" }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain("/friend/invite/tok-123");
    expect(await screen.findByText("링크가 복사되었어요. 친구에게 링크를 보내보세요!")).toBeInTheDocument();
  });

  it("shows an error snackbar (not success) when copying fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "친구 신청 링크 공유하기" }));
    expect(await screen.findByText("링크를 복사하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText("링크가 복사되었어요. 친구에게 링크를 보내보세요!")).not.toBeInTheDocument();
  });

  it("shows a search result card with only the nickname, never a phone number", async () => {
    api.searchPhone.mockResolvedValue({ user: rec("x", "Beam", "none") });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("전화번호로 친구 찾기"), "01012345678");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));

    const card = (await screen.findByText("Beam")).closest(".afs__result") as HTMLElement;
    expect(within(card).getByRole("button", { name: "친구 신청" })).toBeInTheDocument();
    expect(card.textContent).not.toMatch(/\d{3,}/); // no raw phone digits in the card
  });

  it("shows a distinct not-found state for an unmatched number", async () => {
    api.searchPhone.mockResolvedValue({ user: null });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("전화번호로 친구 찾기"), "01099998888");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText("해당 전화번호로 가입한 사용자를 찾을 수 없어요")).toBeInTheDocument();
  });

  it("renders English chrome for an English user", async () => {
    mockLang = "en";
    wrap(<AddFriendSheet open onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "Add Friend" })).toBeInTheDocument();
    expect(await screen.findByText("No friends to suggest")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share friend invitation link" })).toBeInTheDocument();
    expect(screen.getByText("Send Friend Invitation Link")).toBeInTheDocument();
  });
});

describe("IncomingFriendRequestSheet", () => {
  const request = {
    request_id: "r1",
    user_id: "u1",
    nickname: "Beam",
    profile_image_type: "NONE" as const,
    created_at: new Date().toISOString(),
    relative_time: "2h ago",
  };

  it("renders the requester fetched from the server", async () => {
    api.getRequest.mockResolvedValue(request);
    wrap(<IncomingFriendRequestSheet open requestId="r1" onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "친구 요청" })).toBeInTheDocument();
    expect(await screen.findByText("Beam님이 친구를 신청했어요")).toBeInTheDocument();
    const card = screen.getByText("Beam", { selector: ".afs__result-name" });
    expect(card).toBeInTheDocument();
    await waitFor(() => expect(api.getRequest).toHaveBeenCalledWith("r1"));
  });

  it("rejects the request and closes", async () => {
    api.getRequest.mockResolvedValue(request);
    const onClose = vi.fn();
    wrap(<IncomingFriendRequestSheet open requestId="r1" onClose={onClose} />);
    await userEvent.click(await screen.findByRole("button", { name: "거절" }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.accept).not.toHaveBeenCalled();
  });

  it("accepts the request (one call) and closes", async () => {
    api.getRequest.mockResolvedValue(request);
    let resolve!: () => void;
    api.accept.mockReturnValue(new Promise((r) => { resolve = () => r({}); }));
    const onClose = vi.fn();
    wrap(<IncomingFriendRequestSheet open requestId="r1" onClose={onClose} />);
    const acceptBtn = await screen.findByRole("button", { name: "수락" });
    await userEvent.click(acceptBtn);
    await userEvent.click(acceptBtn); // ignored (busy)
    expect(api.accept).toHaveBeenCalledTimes(1);
    resolve();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
