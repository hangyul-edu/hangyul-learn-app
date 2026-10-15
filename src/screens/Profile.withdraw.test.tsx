import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { mine, plans, streak, unread, deletionMethods, deleteAccount } = vi.hoisted(() => ({
  mine: vi.fn(),
  plans: vi.fn(),
  streak: vi.fn(),
  unread: vi.fn(),
  deletionMethods: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  subApi: { mine, plans },
  dashboardApi: { streak },
  authApi: {
    deletionMethods,
    deleteAccount,
    socialStartUrl: (provider: string, challenge: string, returnTo = "/", purpose = "login") =>
      `/api/auth/social/${provider}/start?return_to=${encodeURIComponent(returnTo)}` +
      `&client_challenge=${challenge}${purpose === "reauth" ? "&purpose=reauth" : ""}`,
  },
}));
vi.mock("../lib/http", async (orig) => ({
  ...(await orig<typeof import("../lib/http")>()),
  http: { get: unread },
}));
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({
    me: { nickname: "귤이", profile_image_type: "DEFAULT", avatar_key: null, profile_image_url: null },
    revokeSession: vi.fn(),
    hardSignOut: vi.fn(),
  }),
}));

import { Profile } from "./Profile";
import { I18nProvider } from "../i18n";
import { ApiError } from "../lib/http";
import { savePendingReauth } from "../hooks/socialLogin";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Profile />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function openWithdrawAndConfirm() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "탈퇴하기" }));
  await user.click(screen.getByRole("button", { name: "회원 탈퇴 진행" }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mine.mockResolvedValue({ subscription_id: null, plan_id: null, status: "expired" });
  streak.mockResolvedValue({ current: 1, best: 2, freeze_tokens: 0, last_study_date: null, total_days: 3 });
  unread.mockResolvedValue({ has_unread: false });
  plans.mockResolvedValue({ plans: [] });
});

describe("account deletion confirmation", () => {
  it("asks a password account for its password", async () => {
    deletionMethods.mockResolvedValue({ has_password: true, providers: [], web_providers: [] });
    renderPage();
    await openWithdrawAndConfirm();
    expect(await screen.findByText("비밀번호 입력")).toBeInTheDocument();
    expect(screen.queryByText("본인 확인")).not.toBeInTheDocument();
  });

  it("sends a social-only account to re-authenticate with its provider", async () => {
    deletionMethods.mockResolvedValue({ has_password: false, providers: ["apple"], web_providers: ["apple"] });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, assign } });
    try {
      renderPage();
      const user = await openWithdrawAndConfirm();
      expect(await screen.findByText("본인 확인")).toBeInTheDocument();
      expect(screen.queryByText("비밀번호 입력")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Apple로 계속하기" }));
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
      const url = assign.mock.calls[0][0] as string;
      expect(url).toContain("/auth/social/apple/start");
      expect(url).toContain("purpose=reauth");
      expect(url).toContain(`return_to=${encodeURIComponent("/profile")}`);
      // The verifier and the re-auth marker stay in this browser.
      expect(window.localStorage.getItem("hg-social-verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(window.localStorage.getItem("hg-social-purpose")).toBe("reauth");
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original });
    }
  });

  it("says the deletion needs the app when no provider can re-authenticate on the web", async () => {
    deletionMethods.mockResolvedValue({ has_password: false, providers: ["apple"], web_providers: [] });
    renderPage();
    await openWithdrawAndConfirm();
    expect(await screen.findByText(/웹에서 본인 확인을 할 수 없어요/)).toBeInTheDocument();
  });

  it("finishes the deletion with the re-authentication code when the browser comes back", async () => {
    deleteAccount.mockResolvedValue(undefined);
    savePendingReauth({ provider: "apple", reauth_code: "rc-1", client_verifier: "v".repeat(43) });
    renderPage();
    expect(await screen.findByText("탈퇴가 완료됐습니다")).toBeInTheDocument();
    expect(deleteAccount).toHaveBeenCalledWith({
      provider: "apple",
      reauth_code: "rc-1",
      client_verifier: "v".repeat(43),
    });
    expect(window.sessionStorage.getItem("hg-withdraw-reauth")).toBeNull();
  });

  it("explains why the portal's last super admin cannot withdraw", async () => {
    deletionMethods.mockResolvedValue({ has_password: true, providers: [], web_providers: [] });
    deleteAccount.mockRejectedValue(
      new ApiError(409, "conflict", "last super admin", { reason: "last_super_admin" }, undefined),
    );
    renderPage();
    const user = await openWithdrawAndConfirm();
    await user.type(await screen.findByLabelText("현재 비밀번호"), "Hangyul!2026");
    await user.click(within(screen.getByRole("dialog", { name: "비밀번호 입력" })).getByRole("button", { name: "회원 탈퇴 진행" }));

    expect(await screen.findByText(/마지막 최고 관리자 계정은 탈퇴할 수 없어요/)).toBeInTheDocument();
    expect(screen.queryByText("탈퇴가 완료됐습니다")).not.toBeInTheDocument();
  });

  it("explains a re-authentication with a different provider account", async () => {
    deletionMethods.mockResolvedValue({ has_password: false, providers: ["apple"], web_providers: ["apple"] });
    deleteAccount.mockRejectedValue(
      new ApiError(403, "auth.social_identity_mismatch", "not linked", undefined, undefined),
    );
    savePendingReauth({ provider: "apple", reauth_code: "rc-2", client_verifier: "v".repeat(43) });
    renderPage();
    expect(await screen.findByText(/이 계정에 연결된 소셜 계정이 아니에요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apple로 계속하기" })).toBeInTheDocument();
  });

  it("explains a cancelled provider sign-in without deleting", async () => {
    deletionMethods.mockResolvedValue({ has_password: false, providers: ["kakao"], web_providers: ["kakao"] });
    savePendingReauth({ error: "cancelled" });
    renderPage();
    expect(await screen.findByText("로그인을 취소해서 탈퇴를 진행하지 않았어요.")).toBeInTheDocument();
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
