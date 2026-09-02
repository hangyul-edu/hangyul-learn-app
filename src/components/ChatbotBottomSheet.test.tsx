import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/endpoints", () => ({
  aiApi: { startConversation: vi.fn(), sendMessage: vi.fn() },
}));

import { aiApi } from "../api/endpoints";
import { ChatbotBottomSheet } from "./ChatbotBottomSheet";

const api = aiApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const msg = (id: string, role: string, content: string) => ({ message_id: id, role, content, created_at: "" });

beforeEach(() => {
  vi.clearAllMocks();
  api.startConversation.mockResolvedValue({ conversation: { conversation_id: "c1", title: "" }, first_assistant_message: null });
  api.sendMessage.mockResolvedValue({ user_message: msg("u1", "user", "안녕"), assistant_message: msg("a1", "assistant", "반가워요") });
});

describe("ChatbotBottomSheet (shared page chatbot)", () => {
  it("shows the sheet chrome, greeting, and creates a conversation on open", async () => {
    render(<I18nProvider language="ko"><ChatbotBottomSheet open source="personalized_learning" onClose={() => {}} /></I18nProvider>);
    expect(screen.getByRole("dialog", { name: "물어보기" })).toBeInTheDocument();
    expect(screen.getByText("무엇이든 물어보세요!")).toBeInTheDocument();
    expect(screen.getByText(/AI 답변은 완벽하지 않거나 실수할 수 있어요/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("채팅을 입력하세요.")).toBeInTheDocument();
    await waitFor(() => expect(api.startConversation).toHaveBeenCalledWith({}));
  });

  it("sends a message and appends the reply", async () => {
    render(<I18nProvider language="ko"><ChatbotBottomSheet open source="personalized_learning" onClose={() => {}} /></I18nProvider>);
    const input = screen.getByPlaceholderText("채팅을 입력하세요.");
    await userEvent.type(input, "안녕");
    const send = screen.getByRole("button", { name: "메시지 보내기" });
    await waitFor(() => expect(send).toBeEnabled()); // conversation ready
    await userEvent.click(send);
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledWith("c1", "안녕"));
    expect(await screen.findByText("반가워요")).toBeInTheDocument();
  });

  it("disables send when empty and blocks duplicate submits", async () => {
    let resolve!: () => void;
    api.sendMessage.mockReturnValue(new Promise((r) => { resolve = () => r({ user_message: msg("u1", "user", "안녕"), assistant_message: msg("a1", "assistant", "네") }); }));
    render(<I18nProvider language="ko"><ChatbotBottomSheet open source="lecture" onClose={() => {}} /></I18nProvider>);
    const send = screen.getByRole("button", { name: "메시지 보내기" });
    expect(send).toBeDisabled(); // empty input
    await userEvent.type(screen.getByPlaceholderText("채팅을 입력하세요."), "안녕");
    await waitFor(() => expect(send).toBeEnabled());
    await userEvent.click(send);
    await userEvent.click(send); // ignored (sending)
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    resolve();
  });

  it("tags the opening surface and closes via the X", async () => {
    const onClose = vi.fn();
    render(<I18nProvider language="ko"><ChatbotBottomSheet open source="lecture" onClose={onClose} /></I18nProvider>);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-source", "lecture");
    await userEvent.click(screen.getByRole("button", { name: "물어보기 창 닫기" }));
    expect(onClose).toHaveBeenCalled();
  });
});
