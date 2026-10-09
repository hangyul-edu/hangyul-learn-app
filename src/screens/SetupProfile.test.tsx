import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { checkNickname, uploadImage, registerProfile } = vi.hoisted(() => ({
  checkNickname: vi.fn(),
  uploadImage: vi.fn(),
  registerProfile: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  userApi: { checkNickname, uploadImage, registerProfile },
}));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ setMe: vi.fn() }) }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { SetupProfile } from "./SetupProfile";
import { I18nProvider } from "../i18n";

function renderSetup() {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <SetupProfile />
      </MemoryRouter>
    </I18nProvider>,
  );
}

const checkBtn = () => screen.getByRole("button", { name: "닉네임 중복확인" });
const submitBtn = () => document.querySelector<HTMLButtonElement>(".setupp__submit")!;

beforeEach(() => vi.clearAllMocks());

describe("SetupProfile nickname check", () => {
  it("arms 시작하기 for the nickname that was checked", async () => {
    checkNickname.mockResolvedValue({ nickname: "귤이", available: true, check_token: "tok" });
    renderSetup();
    await userEvent.type(screen.getByLabelText("닉네임"), "귤이");
    await userEvent.click(checkBtn());
    expect(await screen.findByText("사용가능한 닉네임입니다.")).toBeInTheDocument();
    expect(submitBtn()).toBeEnabled();
  });

  it("ignores a check that answers for a nickname edited since", async () => {
    // Regression: a late "available" for the OLD value still armed 시작하기
    // with a token the server binds to that old nickname.
    let answer!: (v: unknown) => void;
    checkNickname.mockReturnValue(new Promise((r) => (answer = r)));
    renderSetup();
    const input = screen.getByLabelText("닉네임");
    await userEvent.type(input, "귤이");
    await userEvent.click(checkBtn());
    await userEvent.type(input, "야"); // edited mid-check
    answer({ nickname: "귤이", available: true, check_token: "tok-old" });

    await waitFor(() => expect(checkBtn()).toBeEnabled());
    expect(screen.queryByText("사용가능한 닉네임입니다.")).not.toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
  });
});

describe("SetupProfile profile image", () => {
  const preview = () => document.querySelector<HTMLElement>(".setupp__preview-circle")!;
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

  it("shows the selected character as the profile image", async () => {
    renderSetup();
    await userEvent.click(screen.getByRole("radio", { name: "초록 학사모 귤 캐릭터" }));
    expect(preview()).toHaveAttribute("aria-label", "프로필 이미지: 초록 학사모 귤 캐릭터");
    expect(preview().querySelector(".setupp__preview-char img")).not.toBeNull();
    expect(screen.getByRole("radio", { name: "초록 학사모 귤 캐릭터" })).toHaveAttribute("aria-checked", "true");
  });

  it("replaces an uploaded photo with the character chosen afterwards, and saves the character", async () => {
    uploadImage.mockResolvedValue({ profile_image_url: "https://cdn.test/me.jpg" });
    checkNickname.mockResolvedValue({ nickname: "귤이", available: true, check_token: "tok" });
    registerProfile.mockResolvedValue({ user_id: "u1" });
    renderSetup();

    await userEvent.upload(fileInput(), new File(["x"], "me.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(preview()).toHaveAttribute("aria-label", "프로필 이미지: 업로드한 사진"));
    expect(preview().querySelector('img[src="https://cdn.test/me.jpg"]')).not.toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: "학사모와 책을 든 귤 캐릭터" }));
    expect(preview()).toHaveAttribute("aria-label", "프로필 이미지: 학사모와 책을 든 귤 캐릭터");
    expect(preview().querySelector('img[src="https://cdn.test/me.jpg"]')).toBeNull();

    await userEvent.type(screen.getByLabelText("닉네임"), "귤이");
    await userEvent.click(checkBtn());
    await screen.findByText("사용가능한 닉네임입니다.");
    await userEvent.click(submitBtn());
    await waitFor(() => expect(registerProfile).toHaveBeenCalled());
    expect(registerProfile.mock.calls[0][0]).toMatchObject({
      profile_image_type: "AVATAR",
      avatar_key: "AVATAR_03",
      profile_image_url: null,
    });
  });
});
