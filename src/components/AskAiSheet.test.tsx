import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../i18n";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../api/endpoints", () => ({
  aiApi: { startConversation: vi.fn(), sendMessage: vi.fn() },
  studyApi: { askTutor: vi.fn() },
}));

import { aiApi, studyApi } from "../api/endpoints";
import { AskAiSheet, type AskContext } from "./AskAiSheet";
import { ApiError } from "../lib/http";

const ai = aiApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const tutor = studyApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const reply = (answer: string, turnsLeft = 5) => ({
  turn_id: "tt_1",
  mode: "hint_only",
  route: "stored_hint",
  answer,
  cited_sentence: null,
  examples: [],
  turns_left: turnsLeft,
  replayed: false,
});

const activityContext = (over: Partial<AskContext> = {}): AskContext => ({
  contextKind: "study_activity",
  sessionId: "ss_1",
  contextId: "act_1",
  autoExplain: false,
  bubble: false,
  ...over,
});

function renderSheet(context: AskContext) {
  return render(
    <I18nProvider language="ko">
      <AskAiSheet open context={context} onClose={() => {}} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tutor.askTutor.mockResolvedValue(reply("받침에 주의해 보세요."));
});

describe("AskAiSheet — session activity (grounded tutor)", () => {
  it("after a wrong answer opens with a hint request to the tutor, not the chatbot", async () => {
    renderSheet(activityContext({ autoExplain: true, bubble: true }));
    await waitFor(() =>
      expect(tutor.askTutor).toHaveBeenCalledWith(
        "ss_1",
        "act_1",
        expect.objectContaining({ question: "제 답이 왜 틀렸는지 힌트를 주세요.", language: "ko" }),
      ),
    );
    expect(await screen.findByText("받침에 주의해 보세요.")).toBeInTheDocument();
    expect(ai.startConversation).not.toHaveBeenCalled();
  });

  it("waits for the learner's own question when nothing went wrong yet", async () => {
    renderSheet(activityContext());
    await userEvent.type(screen.getByPlaceholderText("채팅을 입력하세요."), "이 표현은 언제 써요?");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    await waitFor(() =>
      expect(tutor.askTutor).toHaveBeenCalledWith("ss_1", "act_1", expect.objectContaining({ question: "이 표현은 언제 써요?" })),
    );
    expect(tutor.askTutor).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("이 표현은 언제 써요?")).toBeInTheDocument();
  });

  it("says so when the question limit is reached and stops sending", async () => {
    tutor.askTutor.mockRejectedValue(new ApiError(409, "tutor.turn_limit", ""));
    renderSheet(activityContext());
    await userEvent.type(screen.getByPlaceholderText("채팅을 입력하세요."), "하나 더");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByText("이 문제에 대한 질문을 모두 사용했어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "메시지 보내기" })).toBeDisabled();
  });
});

describe("AskAiSheet — item chatbot", () => {
  const sentenceContext: AskContext = { contextKind: "sentence", contextId: "s_1", autoExplain: false, bubble: false };

  it("says so when a message fails to send, keeps the draft, and sends it again", async () => {
    ai.startConversation.mockResolvedValue({ conversation: { conversation_id: "c_1" }, first_assistant_message: null });
    ai.sendMessage.mockRejectedValueOnce(new Error("보내지 못했어요"));
    renderSheet(sentenceContext);
    const input = screen.getByPlaceholderText("채팅을 입력하세요.");
    await waitFor(() => expect(ai.startConversation).toHaveBeenCalled());
    await userEvent.type(input, "이건 무슨 뜻이에요?");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByText("보내지 못했어요")).toBeInTheDocument();
    expect(input).toHaveValue("이건 무슨 뜻이에요?");
    // No "retry" here: that would open a new thread, not resend the message.
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();

    const at = new Date().toISOString();
    ai.sendMessage.mockResolvedValueOnce({
      user_message: { message_id: "m1", role: "user", content: "이건 무슨 뜻이에요?", created_at: at },
      assistant_message: { message_id: "m2", role: "assistant", content: "그건 이런 뜻이에요.", created_at: at },
    });
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByText("그건 이런 뜻이에요.")).toBeInTheDocument();
    expect(screen.queryByText("보내지 못했어요")).not.toBeInTheDocument();
  });
});

/* The free plan's 5 questions a day are spent: the server refuses with 429
   ai_daily_limit and the sheet shows the limit notice at its top (744:48051). */
const dailyLimit = () => new ApiError(429, "rate_limited", "", { reason: "ai_daily_limit", limit: 5 });
const NOTICE = ["오늘 AI 질문은 5개까지 가능해요", "프리미엄에서는 제한 없이 질문할 수 있어요✨"];

describe("AskAiSheet — the daily question limit", () => {
  it("tutor: a refused question shows the notice, keeps the draft and no error", async () => {
    tutor.askTutor.mockRejectedValue(dailyLimit());
    renderSheet(activityContext());
    const input = screen.getByPlaceholderText("채팅을 입력하세요.");
    await userEvent.type(input, "하나 더");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    const notice = await screen.findByRole("alert");
    expect(notice).toHaveTextContent(NOTICE.join(""));
    expect(input).toHaveValue("하나 더");
    expect(screen.queryByText("하나 더", { selector: ".askai__msg-line" })).not.toBeInTheDocument();
    expect(screen.queryByText(/설명을 불러오지 못했어요/)).not.toBeInTheDocument();
  });

  it("tutor: the hint request after a wrong answer is sent as automatic, and its refusal shows the notice", async () => {
    tutor.askTutor.mockRejectedValue(dailyLimit());
    renderSheet(activityContext({ autoExplain: true, bubble: true }));
    await waitFor(() =>
      expect(tutor.askTutor).toHaveBeenCalledWith("ss_1", "act_1", expect.objectContaining({ automatic: true })),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(NOTICE[0]);
    expect(screen.queryByRole("button", { name: "다시 시도" })).not.toBeInTheDocument();
  });

  it("tutor: a question the learner types is not automatic", async () => {
    renderSheet(activityContext());
    await userEvent.type(screen.getByPlaceholderText("채팅을 입력하세요."), "왜요?");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    await waitFor(() => expect(tutor.askTutor).toHaveBeenCalled());
    expect(tutor.askTutor.mock.calls[0][2]).not.toHaveProperty("automatic");
  });

  it("chatbot: a refused message shows the notice and keeps the draft", async () => {
    ai.startConversation.mockResolvedValue({ conversation: { conversation_id: "c_1" }, first_assistant_message: null });
    ai.sendMessage.mockRejectedValue(dailyLimit());
    renderSheet({ contextKind: "sentence", contextId: "s_1", autoExplain: false, bubble: false });
    const input = screen.getByPlaceholderText("채팅을 입력하세요.");
    await waitFor(() => expect(ai.startConversation).toHaveBeenCalled());
    await userEvent.type(input, "또 질문");
    await userEvent.click(screen.getByRole("button", { name: "메시지 보내기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(NOTICE.join(""));
    expect(input).toHaveValue("또 질문");
  });

  it("chatbot: a refused automatic explanation shows the notice and opens the chat without it", async () => {
    ai.startConversation
      .mockRejectedValueOnce(dailyLimit())
      .mockResolvedValueOnce({ conversation: { conversation_id: "c_2" }, first_assistant_message: null });
    renderSheet({ contextKind: "quiz_attempt", contextId: "qa_1", autoExplain: true, bubble: true });
    expect(await screen.findByRole("alert")).toHaveTextContent(NOTICE[0]);
    await waitFor(() => expect(ai.startConversation).toHaveBeenCalledTimes(2));
    expect(ai.startConversation.mock.calls[1][0]).toMatchObject({ auto_assistant_reply: false });
    expect(screen.queryByText(/설명을 불러오지 못했어요/)).not.toBeInTheDocument();
  });
});
