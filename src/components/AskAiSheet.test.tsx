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
