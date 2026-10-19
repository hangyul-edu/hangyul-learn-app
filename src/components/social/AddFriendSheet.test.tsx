import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../hooks/toast";
import type { ReactNode } from "react";
import { phoneExample } from "../../lib/phone";

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
let mockLang: "ko" | "en" = "ko";
vi.mock("../../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: mockLang } }) }));

import { friendApi } from "../../api/endpoints";
import { AddFriendSheet, IncomingFriendRequestSheet } from "./AddFriendSheet";
import { I18nProvider } from "../../i18n";

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
    // Mirrors <LanguageSync>: the provider adopts the profile language.
    <I18nProvider language={mockLang}>
      <QueryClientProvider client={qc}>
        <ToastProvider>{node}</ToastProvider>
      </QueryClientProvider>
    </I18nProvider>,);
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
    // 2382:25195 is the field LABEL; the placeholder is an example number for
    // the selected country (Korea by default).
    expect(screen.getByText("전화번호로 찾기")).toBeInTheDocument();
    expect(screen.getByLabelText("전화번호로 친구 찾기")).toHaveAttribute("placeholder", phoneExample("KR"));
  });

  it("shows the example number of the country picked", async () => {
    wrap(<AddFriendSheet open onClose={() => {}} />);
    const field = await screen.findByLabelText("전화번호로 친구 찾기");
    // A pasted international number moves the picker, and the example with it.
    await userEvent.type(field, "+12015550123");
    expect(field).toHaveAttribute("placeholder", phoneExample("US"));
    expect(phoneExample("US")).toBe("2015550123");
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

  it("accepting a recommendation names the new friend in the bottom notice", async () => {
    api.accept.mockResolvedValue({});
    api.recommendations.mockResolvedValue({ recommendations: [rec("c", "Cara", "request_received", "req-c")] });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "수락" }));
    await waitFor(() => expect(api.accept).toHaveBeenCalledWith("req-c"));
    const notice = await screen.findByText("Cara님과 친구가 되었어요!");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
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

  it("cancels a pending outgoing request by its request id, only once confirmed", async () => {
    api.recommendations.mockResolvedValue({ recommendations: [rec("b", "Bob", "request_sent", "req-b")] });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "요청 취소" }));
    const dialog = await screen.findByRole("dialog", { name: "Bob님에게 보낸 요청을 취소할까요?" });
    expect(api.cancel).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "요청 취소" }));
    await waitFor(() => expect(api.cancel).toHaveBeenCalledWith("req-b"));
    expect((await screen.findByText("요청을 취소했어요")).closest(".hg-toast")).toHaveClass(
      "hg-toast--notice",
      "hg-toast--line",
    );
  });

  it("돌아가기 leaves a sent request alone", async () => {
    api.recommendations.mockResolvedValue({ recommendations: [rec("b", "Bob", "request_sent", "req-b")] });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "요청 취소" }));
    await userEvent.click(within(await screen.findByRole("dialog", { name: /Bob님에게/ })).getByRole("button", { name: "돌아가기" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Bob님에게/ })).not.toBeInTheDocument());
    expect(api.cancel).not.toHaveBeenCalled();
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
    expect(card.textContent).not.toMatch(/\d{3,}/); // no raw phone digits in the card
    // LEG-020: the card is avatar + name; its action is the sheet's bottom button.
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    const action = screen.getByRole("button", { name: "친구 신청" });
    expect(card.nextElementSibling).toBe(action);
  });

  it("shows a search result in place of the suggestions, which return once the number is edited", async () => {
    api.recommendations.mockResolvedValue({ recommendations: [rec("a", "Ann", "none")] });
    api.searchPhone.mockResolvedValue({ user: rec("x", "Beam", "none") });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    expect(await screen.findByText("Ann")).toBeInTheDocument();

    const input = screen.getByLabelText("전화번호로 친구 찾기");
    await userEvent.type(input, "01012345678");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText("Beam")).toBeInTheDocument();
    expect(screen.queryByText("Ann")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "추천 친구" })).not.toBeInTheDocument();

    await userEvent.type(input, "{backspace}");
    expect(screen.queryByText("Beam")).not.toBeInTheDocument();
    expect(screen.getByText("Ann")).toBeInTheDocument();
  });

  it("confirms a sent request with the same bottom notice as the other friend actions", async () => {
    api.searchPhone.mockResolvedValue({ user: rec("x", "Beam", "none") });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("전화번호로 친구 찾기"), "01012345678");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    await userEvent.click(await screen.findByRole("button", { name: "친구 신청" }));

    const notice = await screen.findByText("친구 신청을 보냈어요");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
  });

  it("shows a distinct not-found state for an unmatched number", async () => {
    api.searchPhone.mockResolvedValue({ user: null });
    wrap(<AddFriendSheet open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("전화번호로 친구 찾기"), "01099998888");
    await userEvent.click(screen.getByRole("button", { name: "검색" }));
    const card = (await screen.findByText("일치하는 사용자가 없어요")).closest(".afs__notfound") as HTMLElement;
    expect(card).toHaveTextContent("번호를 다시 확인해 주세요");
    // The bottom Friend Request button stays, disabled; the suggestions are gone.
    expect(card.nextElementSibling).toBe(screen.getByRole("button", { name: "친구 신청" }));
    expect(screen.getByRole("button", { name: "친구 신청" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "추천 친구" })).not.toBeInTheDocument();
  });

  it("renders English chrome for an English user", async () => {
    mockLang = "en";
    wrap(<AddFriendSheet open onClose={() => {}} />);
    expect(await screen.findByRole("dialog", { name: "Add Friend" })).toBeInTheDocument();
    expect(await screen.findByText("No suggestions available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share friend invitation link" })).toBeInTheDocument();
    expect(screen.getByText("Send friend request link")).toBeInTheDocument();
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
    // The bottom notice (cp_G_03_toast), as after an accept.
    const notice = await screen.findByText("요청을 거절했어요");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
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
    // Named bottom notice (cp_G_03_toast) using the requester's fetched nickname.
    const notice = await screen.findByText("Beam님과 친구가 되었어요!");
    expect(notice.closest(".hg-toast")).toHaveClass("hg-toast--notice", "hg-toast--line");
  });
});
