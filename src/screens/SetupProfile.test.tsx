import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { checkNickname } = vi.hoisted(() => ({ checkNickname: vi.fn() }));
vi.mock("../api/endpoints", () => ({
  userApi: { checkNickname, uploadImage: vi.fn(), registerProfile: vi.fn() },
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
