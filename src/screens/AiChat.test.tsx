import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const { startConversation, sendMessage } = vi.hoisted(() => ({
  startConversation: vi.fn(),
  sendMessage: vi.fn(),
}));
// The real response shapes of POST /ai/conversations and .../messages.
vi.mock("../api/endpoints", () => ({ aiApi: { startConversation, sendMessage } }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { AiChat } from "./AiChat";
import { I18nProvider } from "../i18n";

function renderChat() {
  return render(
    <I18nProvider language="ko">
      <MemoryRouter>
        <AiChat />
      </MemoryRouter>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  startConversation.mockResolvedValue({
    conversation: { conversation_id: "c1", title: "Chat" },
    first_assistant_message: null,
  });
  sendMessage.mockResolvedValue({
    user_message: { message_id: "m1", role: "user", content: "안녕?", created_at: "x" },
    assistant_message: { message_id: "m2", role: "assistant", content: "안녕하세요, 반가워요", created_at: "x" },
  });
});

describe("AI tutor chat", () => {
  it("sends into the started conversation and shows the tutor's reply", async () => {
    // Regression: the screen read `conversation_id` and `reply` at the top level
    // of the responses, so no message was ever sent and replies showed as "…".
    renderChat();
    const input = await screen.findByPlaceholderText("메시지를 입력하세요");
    await userEvent.type(input, "안녕?{Enter}");
    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("c1", "안녕?"));
    expect(await screen.findByText("안녕하세요, 반가워요")).toBeInTheDocument();
  });

  it("offers a retry when the conversation cannot be started", async () => {
    startConversation.mockRejectedValueOnce(new Error("down"));
    renderChat();
    await userEvent.click(await screen.findByRole("button", { name: "다시 시도" }));
    expect(await screen.findByPlaceholderText("메시지를 입력하세요")).toBeInTheDocument();
    expect(startConversation).toHaveBeenCalledTimes(2);
  });
});
