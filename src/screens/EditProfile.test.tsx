import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { ToastProvider } from "../hooks/toast";
import type { Me } from "../lib/types";

/* ------------------------------ mocks ---------------------------------- */
const setMe = vi.fn();
const mockMe: Me = {
  user_id: "u1",
  email: "a@b.co",
  name: "홍길동",
  nickname: "곰돌이",
  phone: null,
  nationality: null,
  profile_image_type: "NONE",
  avatar_key: null,
  profile_image_url: null,
  phone_verified: false,
  app_language: "ko",
  role: "member",
  service_notification_consent: true,
  marketing_push_consent: false,
  email_sms_marketing_consent: false,
  today_streak_achieved: false,
  onboarding_completed: true,
  membership: { tier: "free", is_premium: false, expires_at: null },
  created_at: "2026-01-01T00:00:00Z",
};
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe, setMe }) }));
vi.mock("../api/endpoints", () => ({
  userApi: {
    checkNickname: vi.fn(),
    uploadImage: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

import { userApi } from "../api/endpoints";
import { EditProfile } from "./EditProfile";

const api = userApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderEdit() {
  const router = createMemoryRouter(
    [
      // Edit Profile is reached from the More/Profile page and leaves back to it.
      { path: "/profile", element: <div>PROFILE_SCREEN</div> },
      { path: "/edit", element: <EditProfile /> },
    ],
    { initialEntries: ["/profile", "/edit"], initialIndex: 1 },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const backBtn = () => screen.getByRole("button", { name: "뒤로" });
const modal = () => screen.queryByRole("alertdialog");

beforeEach(() => vi.clearAllMocks());

/* ------------------------------ tests ---------------------------------- */
describe("EditProfile unsaved-changes guard", () => {
  it("leaves immediately when there are no changes", async () => {
    renderEdit();
    await userEvent.click(backBtn());
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });

  it("shows the confirmation modal (correct copy) when leaving with a nickname change", async () => {
    renderEdit();
    const input = screen.getByLabelText("닉네임");
    await userEvent.type(input, "2"); // 곰돌이 → 곰돌이2
    await userEvent.click(backBtn());
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg).toBeInTheDocument();
    expect(screen.getByText("프로필 변경을 종료할까요?")).toBeInTheDocument();
    expect(screen.getByText("저장하지 않고 나가면 변경사항이 사라져요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "나가기" })).toBeInTheDocument();
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
  });

  it("취소 keeps the user on the screen with edits intact", async () => {
    renderEdit();
    const input = screen.getByLabelText("닉네임") as HTMLInputElement;
    await userEvent.type(input, "2");
    await userEvent.click(backBtn());
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(modal()).not.toBeInTheDocument());
    expect(screen.queryByText("PROFILE_SCREEN")).not.toBeInTheDocument();
    expect(input.value).toBe("곰돌이2"); // edits preserved
  });

  it("나가기 discards changes and navigates away", async () => {
    renderEdit();
    await userEvent.type(screen.getByLabelText("닉네임"), "2");
    await userEvent.click(backBtn());
    await screen.findByRole("alertdialog");
    await userEvent.click(screen.getByRole("button", { name: "나가기" }));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
  });

  it("reverting a change back to the original clears the dirty state", async () => {
    renderEdit();
    const input = screen.getByLabelText("닉네임");
    await userEvent.type(input, "2");
    await userEvent.type(input, "{backspace}"); // back to 곰돌이
    await userEvent.click(backBtn());
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });

  it("selecting a default character makes the screen dirty", async () => {
    renderEdit();
    const chars = screen.getAllByRole("radio");
    await userEvent.click(chars[0]);
    await userEvent.click(backBtn());
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("does not prompt after a successful save", async () => {
    api.updateProfile.mockResolvedValue({ ...mockMe });
    renderEdit();
    // A character change enables Save without a nickname re-check.
    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.click(screen.getByRole("button", { name: "저장하기" }));
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("PROFILE_SCREEN")).toBeInTheDocument();
    expect(modal()).not.toBeInTheDocument();
  });
});
