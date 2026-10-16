import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

/* ---- mocks: keep the heavy session chrome out of the way, but expose the
   correct/total counters so tests can assert completion credit ---- */
vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({
    children,
    correct,
    total,
    panel,
    askContext,
  }: {
    children: React.ReactNode;
    correct: number;
    total: number;
    panel?: React.ReactNode;
    askContext?: unknown;
  }) => (
    <div>
      <div data-testid="counter">
        {correct}/{total}
      </div>
      <div data-testid="ask-context">{JSON.stringify(askContext ?? null)}</div>
      {panel}
      {children}
    </div>
  ),
}));
vi.mock("../components/SessionCompleteModal", () => ({ SessionCompleteModal: () => null }));

const { recSentences, blankAttempt, blankHint, speechAttempt, summary, toastError, toastShow, toastSuccess, study, recordActivity } = vi.hoisted(
  () => ({
    recordActivity: vi.fn(),
    recSentences: vi.fn(),
    blankAttempt: vi.fn(),
    blankHint: vi.fn(),
    speechAttempt: vi.fn(),
    summary: vi.fn(),
    toastError: vi.fn(),
    toastShow: vi.fn(),
    toastSuccess: vi.fn(),
    study: {
      start: vi.fn(),
      present: vi.fn(),
      attempt: vi.fn(),
      voiceAttempt: vi.fn(),
      hint: vi.fn(),
      reveal: vi.fn(),
      customize: vi.fn(),
      complete: vi.fn(),
      abandon: vi.fn(),
    },
  }),
);
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: toastError, success: toastSuccess, show: toastShow }) }));

const PREMIUM = { tier: "premium", is_premium: true, expires_at: null } as const;
const FREE = { tier: "free", is_premium: false, expires_at: null } as const;
let mockMe: { app_language: string; membership?: typeof PREMIUM | typeof FREE } = { app_language: "ko", membership: PREMIUM };
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe }) }));

vi.mock("../api/endpoints", () => ({
  recApi: { sentences: recSentences },
  sentenceApi: {
    blankAttempt,
    blankHint,
    speechAttempt,
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
    audio: vi.fn().mockResolvedValue({ url: "http://x/a.mp3" }),
  },
  dashboardApi: { summary },
  learnApi: { recordSession: vi.fn(), recordActivity },
  studyApi: study,
}));

/* ---- minimal MediaRecorder / getUserMedia so voice attempts can be driven ---- */
class MockMediaRecorder {
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) });
    this.onstop?.();
  }
}

import { SessionConversation } from "./SessionConversation";
import { I18nProvider } from "../i18n";
import { ApiError } from "../lib/http";

const SENTENCE = {
  sentence_id: "sen_thanks_01",
  korean: "덕분에 잘 지내고 있어요.",
  display_text: "덕분에 잘 ___ 있어요.",
  blanks: [{ index: 0, blank_id: "blank-1", display_width_em: 8, revealed_text: "" }],
  translation: "Good things are on the way.",
  translation_language: "en",
  level: 3,
  bookmarked: false,
};

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <SessionConversation /> }], {
    initialEntries: ["/"],
  });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear(); // isolate the persisted-session snapshot between tests
  mockMe = { app_language: "ko", membership: PREMIUM };
  summary.mockResolvedValue({
    tracks: [{ category: "conversation", level: 3, goal: { target: 3, current: 0, achieved: false } }],
  });
  recSentences.mockResolvedValue({ items: [SENTENCE] });
  // By default no reviewed content fits, so the screen falls back to the
  // recommender — the legacy path most of these tests exercise. The adaptive
  // session tests below override this.
  study.start.mockRejectedValue(new ApiError(409, "session.no_eligible_content", ""));
  study.present.mockResolvedValue(undefined);
  study.complete.mockResolvedValue({});
  study.abandon.mockResolvedValue({});
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
  });
});
afterEach(() => vi.restoreAllMocks());

describe("SessionConversation — study activity on display", () => {
  it("records a conversation activity once when the sentence is displayed, before any answer", async () => {
    recordActivity.mockResolvedValue({ studied_today: true, learning_day_created: true, total_learning_days: 1 });
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await waitFor(() => expect(recordActivity).toHaveBeenCalledTimes(1));
    expect(recordActivity).toHaveBeenCalledWith("conversation", SENTENCE.sentence_id);
    expect(blankAttempt).not.toHaveBeenCalled();
  });
});

describe("SessionConversation — fill-in-the-blank", () => {
  it("renders the prefix, inline blank, and the API explanation (not the answer/full sentence)", async () => {
    const { container } = renderScreen();
    // Prefix + suffix from display_text, and the server explanation.
    await screen.findByText(/덕분에 잘/);
    expect(screen.getByText("Good things are on the way.")).toBeInTheDocument();
    // The inline mint blank is present; the completed sentence / answer is not.
    expect(container.querySelector(".sess__blank")).toBeInTheDocument();
    expect(screen.queryByText("덕분에 잘 지내고 있어요.")).not.toBeInTheDocument();
    expect(screen.queryByText(/지내고/)).not.toBeInTheDocument();
  });

  it("keyboard mode swaps the blank for a focused input; no separate confirm button", async () => {
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = await screen.findByLabelText("빈칸에 들어갈 말");
    expect(input).toBeInTheDocument();
    // The keyboard's action key submits (enterKeyHint="go"); no confirm button.
    expect(input).toHaveAttribute("enterkeyhint", "go");
    expect(screen.getByRole("button", { name: /음성 모드/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "답 확인" })).not.toBeInTheDocument();
    // Empty input → pressing the action key submits nothing.
    await userEvent.type(input, "{Enter}");
    expect(blankAttempt).not.toHaveBeenCalled();
  });

  it("keyboard-mode hint is the input placeholder; typing replaces it, only typed text submits", async () => {
    blankHint.mockResolvedValue({
      blank_id: "blank-1",
      revealed_text: "지",
      revealed_count: 1,
      can_request_another_hint: true,
      hint_used: true,
    });
    blankAttempt.mockResolvedValue(CORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = (await screen.findByLabelText("빈칸에 들어갈 말")) as HTMLInputElement;
    // The hint appears as the input's placeholder — not a separate element beside it.
    await userEvent.click(screen.getByRole("button", { name: /힌트보기/ }));
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "지"));
    expect(document.querySelector(".sess__blank-rev")).toBeNull();
    // Typing replaces the placeholder; only the typed text is submitted (Enter).
    await userEvent.type(input, "지내고{Enter}");
    expect(input.value).toBe("지내고");
    await waitFor(() =>
      expect(blankAttempt).toHaveBeenCalledWith(
        SENTENCE.sentence_id,
        expect.objectContaining({ answerText: "지내고" }),
      ),
    );
  });

  it("submits the typed answer and shows the correct-answer feedback from the server", async () => {
    blankAttempt.mockResolvedValue({
      attempt_id: "blk_1",
      sentence_id: SENTENCE.sentence_id,
      input_mode: "keyboard",
      is_correct: true,
      normalized_answer: "지내고",
      completed_sentence: "덕분에 잘 지내고 있어요.",
      correct_answer: "지내고",
      points_earned: 10,
      submitted_at: "2026-07-22T00:00:00Z",
    });
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");

    await waitFor(() =>
      expect(blankAttempt).toHaveBeenCalledWith(
        SENTENCE.sentence_id,
        expect.objectContaining({ inputMode: "keyboard", answerText: "지내고" }),
      ),
    );
    // Existing correct-feedback flow renders the completed sentence.
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
    expect(screen.getByText("덕분에 잘 지내고 있어요.")).toBeInTheDocument();
  });

  it("hint reveals exactly one leading character from the server, inside the blank", async () => {
    blankHint.mockResolvedValue({
      blank_id: "blank-1",
      revealed_text: "지",
      revealed_count: 1,
      can_request_another_hint: true,
      hint_used: true,
    });
    const { container } = renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /힌트보기/ }));
    await waitFor(() => expect(blankHint).toHaveBeenCalledWith(SENTENCE.sentence_id, 0));
    // The revealed char shows in the blank — and only that char.
    await waitFor(() =>
      expect(container.querySelector(".sess__blank")?.textContent).toBe("지"),
    );
  });

  it("two-step reveal: 힌트보기 shows one char then becomes 정답보기; 정답보기 reveals the full answer and hides the chip", async () => {
    blankHint
      .mockResolvedValueOnce({
        blank_id: "blank-1",
        revealed_text: "지",
        revealed_count: 1,
        can_request_another_hint: true,
        hint_used: true,
      })
      .mockResolvedValueOnce({
        blank_id: "blank-1",
        revealed_text: "지내고",
        revealed_count: 3,
        can_request_another_hint: false,
        hint_used: true,
      });
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = (await screen.findByLabelText("빈칸에 들어갈 말")) as HTMLInputElement;

    // Step 1 — 힌트보기: one leading char, and the button switches to 정답보기.
    await userEvent.click(screen.getByRole("button", { name: /힌트보기/ }));
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "지"));
    expect(blankHint).toHaveBeenNthCalledWith(1, SENTENCE.sentence_id, 0);
    expect(screen.queryByRole("button", { name: /힌트보기/ })).toBeNull();

    // Step 2 — 정답보기: the whole answer is revealed, then the chip disappears.
    await userEvent.click(screen.getByRole("button", { name: /정답보기/ }));
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "지내고"));
    expect(blankHint).toHaveBeenNthCalledWith(2, SENTENCE.sentence_id, 0, true);
    expect(screen.queryByRole("button", { name: /정답보기/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /힌트보기/ })).toBeNull();
  });

  it("does not submit an empty typed answer to the server", async () => {
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    // Press Enter with an empty input.
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "{Enter}");
    expect(blankAttempt).not.toHaveBeenCalled();
  });
});

const CORRECT = {
  attempt_id: "blk_1",
  sentence_id: SENTENCE.sentence_id,
  input_mode: "keyboard",
  is_correct: true,
  normalized_answer: "지내고",
  completed_sentence: "덕분에 잘 지내고 있어요.",
  correct_answer: "지내고",
  points_earned: 10,
  submitted_at: "2026-07-22T00:00:00Z",
};

const SENTENCE_2 = {
  ...SENTENCE,
  sentence_id: "sen_next_02",
  korean: "내일 봐요.",
  display_text: "내일 ___.",
  translation: "See you tomorrow.",
};

async function answerFirstCorrectly() {
  await screen.findByText(/덕분에 잘/);
  await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
  await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");
  await screen.findByText("정답이에요!");
}

describe("SessionConversation — correct-answer bottom sheet", () => {
  it("a correct non-final answer shows the intermediate sheet (다음, no blur)", async () => {
    recSentences.mockResolvedValue({ items: [SENTENCE, SENTENCE_2] });
    blankAttempt.mockResolvedValue(CORRECT);
    const { container } = renderScreen();
    await answerFirstCorrectly();
    expect(screen.getByRole("button", { name: "다음 문제로" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "학습 완료" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).not.toBeInTheDocument();
  });

  it("the left tile is 다시 시작 — never 다시 듣기 — and re-arms the item without playing audio", async () => {
    const { sentenceApi } = await import("../api/endpoints");
    recSentences.mockResolvedValue({ items: [SENTENCE, SENTENCE_2] });
    blankAttempt.mockResolvedValue(CORRECT);
    renderScreen();
    await answerFirstCorrectly();

    expect(screen.queryByRole("button", { name: "다시 듣기" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "다시 시작" }));

    // Same reset the review sheet performs: the verdict clears, the sheet closes
    // and the SAME item is answerable again — the session does not advance.
    await waitFor(() => expect(screen.queryByText("정답이에요!")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "다음 문제로" })).not.toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/2");
    expect(sentenceApi.audio).not.toHaveBeenCalled();
  });

  it("pressing 다음 advances to the next item and closes the sheet", async () => {
    recSentences.mockResolvedValue({ items: [SENTENCE, SENTENCE_2] });
    blankAttempt.mockResolvedValue(CORRECT);
    renderScreen();
    await answerFirstCorrectly();
    await userEvent.click(screen.getByRole("button", { name: "다음 문제로" }));
    // Next item is shown; the correct sheet is gone.
    expect(await screen.findByText(/내일/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 문제로" })).not.toBeInTheDocument();
    expect(screen.queryByText("정답이에요!")).not.toBeInTheDocument();
  });

  it("a correct FINAL answer shows the completion sheet (완료 + blur), not 다음", async () => {
    recSentences.mockResolvedValue({ items: [SENTENCE] }); // single item = final
    blankAttempt.mockResolvedValue(CORRECT);
    const { container } = renderScreen();
    await answerFirstCorrectly();
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음 문제로" })).not.toBeInTheDocument();
    expect(container.querySelector(".casheet__scrim")).toBeInTheDocument();
    // The final answer card stays visible behind the sheet.
    expect(screen.getByText("정답이에요!")).toBeInTheDocument();
  });

  it("the session does not complete until 완료 is pressed (no auto-finish)", async () => {
    recSentences.mockResolvedValue({ items: [SENTENCE] });
    blankAttempt.mockResolvedValue(CORRECT);
    renderScreen();
    await answerFirstCorrectly();
    // Still on the item; the completion sheet is waiting for 완료.
    expect(screen.getByRole("button", { name: "학습 완료" })).toBeInTheDocument();
    expect(screen.getByText("정답이에요!")).toBeInTheDocument();
  });
});

const INCORRECT = {
  attempt_id: "blk_wrong",
  sentence_id: SENTENCE.sentence_id,
  input_mode: "keyboard",
  is_correct: false,
  normalized_answer: "몰라",
  completed_sentence: "덕분에 잘 지내고 있어요.",
  correct_answer: "지내고",
  points_earned: 0,
  submitted_at: "2026-07-22T00:00:00Z",
};

/* A blank-free sentence routes voice attempts through the pronunciation
   evaluator (speechAttempt), which returns a real score + tips. */
const NON_BLANK = {
  sentence_id: "sen_voice_01",
  korean: "좋은 일들이 곧 올 거예요.",
  translation: "Good things are on their way.",
  translation_language: "en",
  level: 3,
  bookmarked: false,
};
const SPEECH_WRONG = {
  attempt_id: "sp_wrong",
  correct: false,
  transcription: "좋은 일들이 고 올 거예요",
  target_text: "좋은 일들이 곧 올 거예요.",
  pronunciation_score: 25,
  feedback_code: "bad_pronunciation",
  tips: ["'일'과 '이' 발음을 조금 더 또렷하게 해보세요"],
  points_earned: 0,
};
const SPEECH_OK = {
  ...SPEECH_WRONG,
  attempt_id: "sp_ok",
  correct: true,
  pronunciation_score: 96,
  feedback_code: "correct",
  tips: [],
  points_earned: 10,
};

async function recordVoice(startLabel: string) {
  await userEvent.click(await screen.findByRole("button", { name: startLabel }));
  await userEvent.click(await screen.findByRole("button", { name: "녹음 멈추기" }));
}

describe("SessionConversation — keyboard incorrect state", () => {
  it("renders the compact retry card: warning header, no next/confirm, no score panel", async () => {
    blankAttempt.mockResolvedValue(INCORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "몰라{Enter}");

    // Incorrect header is shown; there is no way to proceed while wrong.
    expect(await screen.findByText("다시 생각해보세요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "완료" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "답 확인" })).not.toBeInTheDocument();
    // Keyboard mode never shows the pronunciation panel.
    expect(screen.queryByText("발음 정확도")).not.toBeInTheDocument();
    // Both bottom actions are present.
    expect(screen.getByRole("button", { name: /힌트보기/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /음성 모드/ })).toBeInTheDocument();
    // The input is still present and cleared for another attempt.
    const input = screen.getByLabelText("빈칸에 들어갈 말") as HTMLInputElement;
    expect(input.value).toBe("");
    // A wrong attempt does not earn completion credit.
    expect(screen.getByTestId("counter")).toHaveTextContent("0/1");
  });

  it("retries via the IME/Enter action key with a fresh request id and can succeed in place", async () => {
    blankAttempt.mockResolvedValueOnce(INCORRECT).mockResolvedValueOnce(CORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "몰라{Enter}");
    await screen.findByText("다시 생각해보세요");

    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();

    // Two attempts, each with its own idempotency key (retry scored fresh).
    expect(blankAttempt).toHaveBeenCalledTimes(2);
    const id1 = blankAttempt.mock.calls[0][1].clientRequestId;
    const id2 = blankAttempt.mock.calls[1][1].clientRequestId;
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
    expect(id1).not.toBe(id2);
  });

  it("blocks a duplicate submission while the answer is being evaluated", async () => {
    let resolve!: (v: unknown) => void;
    blankAttempt.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = screen.getByLabelText("빈칸에 들어갈 말");
    await userEvent.type(input, "지내고{Enter}");
    // A second submit while the first is in flight is ignored.
    await userEvent.type(input, "{Enter}");
    expect(blankAttempt).toHaveBeenCalledTimes(1);
    // Let the single in-flight attempt settle so its state update is flushed.
    resolve(CORRECT);
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
  });

  it("keeps a technical failure retryable and never treats it as a wrong answer", async () => {
    blankAttempt.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(CORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");

    // A retryable error is surfaced, but the item is not marked incorrect.
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(screen.queryByText("다시 생각해보세요")).not.toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/1");
    // The preserved input can simply be resubmitted → success.
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "{Enter}");
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
  });
});

describe("SessionConversation — voice incorrect state", () => {
  it("renders the pronunciation score ring and actionable feedback from the response", async () => {
    recSentences.mockResolvedValue({ items: [NON_BLANK] });
    speechAttempt.mockResolvedValue(SPEECH_WRONG);
    renderScreen();
    await screen.findByText(/좋은 일들이/);
    await recordVoice("따라 말하기");

    expect(await screen.findByText("다시 생각해보세요")).toBeInTheDocument();
    expect(screen.getByText("발음 정확도")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText(/또렷하게/)).toBeInTheDocument();
    // The score is exposed accessibly (text alternative for the ring).
    expect(screen.getByRole("group", { name: "발음 정확도 25 퍼센트" })).toBeInTheDocument();
    // No progression control, no completion credit.
    expect(screen.queryByRole("button", { name: "학습 완료" })).not.toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/1");
  });

  it("clamps an out-of-range score and still announces it accessibly", async () => {
    recSentences.mockResolvedValue({ items: [NON_BLANK] });
    speechAttempt.mockResolvedValue({ ...SPEECH_WRONG, pronunciation_score: 150 });
    renderScreen();
    await screen.findByText(/좋은 일들이/);
    await recordVoice("따라 말하기");

    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "발음 정확도 100 퍼센트" })).toBeInTheDocument();
  });

  it("falls back to a safe localized message when the response has no tips", async () => {
    recSentences.mockResolvedValue({ items: [NON_BLANK] });
    speechAttempt.mockResolvedValue({ ...SPEECH_WRONG, tips: [] });
    renderScreen();
    await screen.findByText(/좋은 일들이/);
    await recordVoice("따라 말하기");

    expect(await screen.findByText("조금 더 또렷하게 말해보세요.")).toBeInTheDocument();
  });

  it("renders long feedback in full without dropping text", async () => {
    const long =
      "발음 피드백이 매우 길어질 수 있으며 " + "여러 줄로 자연스럽게 줄바꿈되어야 합니다 ".repeat(4);
    recSentences.mockResolvedValue({ items: [NON_BLANK] });
    speechAttempt.mockResolvedValue({ ...SPEECH_WRONG, tips: [long] });
    renderScreen();
    await screen.findByText(/좋은 일들이/);
    await recordVoice("따라 말하기");

    expect(await screen.findByText(/줄바꿈되어야 합니다/)).toBeInTheDocument();
  });

  it("lets the learner record another attempt immediately without advancing", async () => {
    recSentences.mockResolvedValue({ items: [NON_BLANK] });
    speechAttempt.mockResolvedValue(SPEECH_WRONG);
    renderScreen();
    await screen.findByText(/좋은 일들이/);
    await recordVoice("따라 말하기");
    await screen.findByText("다시 생각해보세요");

    // Retry via the (relabeled) mic — still the same item, no completion.
    await recordVoice("다시 녹음하기");
    expect(speechAttempt).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/좋은 일들이/)).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/1");

    // A correct retry finally advances through the normal correct-answer flow.
    speechAttempt.mockResolvedValue(SPEECH_OK);
    await recordVoice("다시 녹음하기");
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
  });
});

describe("SessionConversation — mode switching preserves the session", () => {
  it("keyboard → voice keeps the same item and requests no new content", async () => {
    blankAttempt.mockResolvedValue(INCORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "몰라{Enter}");
    await screen.findByText("다시 생각해보세요");

    await userEvent.click(screen.getByRole("button", { name: /음성 모드/ }));
    // Same sentence, mic ready for a retry, no new recommendation.
    expect(screen.getByText(/덕분에 잘/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 녹음하기" })).toBeInTheDocument();
    expect(recSentences).toHaveBeenCalledTimes(1);
  });

  it("voice → keyboard keeps the item, hides the panel, and requests no new content", async () => {
    // A blank sentence: voice attempt is graded, then we switch to keyboard.
    blankAttempt.mockResolvedValue(INCORRECT);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await recordVoice("따라 말하기");
    await screen.findByText("다시 생각해보세요");
    expect(screen.getByText("발음 정확도")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    // Same item, keyboard input available, panel gone, no new recommendation.
    expect(screen.getByLabelText("빈칸에 들어갈 말")).toBeInTheDocument();
    expect(screen.queryByText("발음 정확도")).not.toBeInTheDocument();
    expect(screen.getByText(/덕분에 잘/)).toBeInTheDocument();
    expect(recSentences).toHaveBeenCalledTimes(1);
  });
});

describe("SessionConversation — a refresh restores the session", () => {
  it("restores the persisted set and progress on remount without requesting new content", async () => {
    recSentences.mockResolvedValue({ items: [SENTENCE, SENTENCE_2] });
    blankAttempt.mockResolvedValue(CORRECT);
    const first = renderScreen();
    await answerFirstCorrectly();
    await userEvent.click(screen.getByRole("button", { name: "다음 문제로" }));
    await screen.findByText(/내일/);
    expect(recSentences).toHaveBeenCalledTimes(1);

    // Simulate a page refresh: tear down and mount a brand-new tree.
    first.unmount();
    recSentences.mockClear();
    renderScreen();

    // The second item is restored from the snapshot; NO recommendation is made.
    expect(await screen.findByText(/내일/)).toBeInTheDocument();
    expect(recSentences).not.toHaveBeenCalled();
  });
});

/* ---- adaptive study sessions (/study-sessions) through the same screen ---- */

const REVEAL = {
  answer_key: { korean: "덕분에 잘 지내고 있어요.", blanks: [{ index: 0, answer: "지내고" }] },
  explanations: [],
};

function activity(id: string, over: Record<string, unknown> = {}) {
  return {
    activity_id: id,
    position: Number(id.slice(-1)),
    phase: "practice",
    activity_kind: "sentence_blank",
    review_kind: "none",
    status: "pending",
    content_version_id: `cv_${id}`,
    quiz_id: null,
    sentence_id: `sen_${id}`,
    is_custom_practice: false,
    hints_used: 0,
    answer_revealed: false,
    attempts: [],
    attempts_left: 2,
    content: {
      display_text: "덕분에 잘 ___ 있어요.",
      translation: "Good things are on the way.",
      translation_language: "en",
      romanization: null,
      has_audio: false,
      blanks: [{ index: 0, start: 6, length: 3 }],
    },
    reveal: null,
    ...over,
  };
}

function sessionWith(activities: unknown[], revision = 1) {
  return {
    session_id: "ss_1",
    track: "conversation",
    status: "active",
    current_revision: revision,
    learner_band: 3,
    requested_activity_count: 3,
    topik_section: null,
    topik_question_type: null,
    shortfall_reason: null,
    shortfall_message: null,
    started_at: "2026-09-26T00:00:00Z",
    activities,
  };
}

function studyResult(over: Record<string, unknown>) {
  return {
    attempt_no: 1,
    correct: false,
    replayed: false,
    activity_status: "attempted",
    attempts_left: 1,
    evidence_policy: "independent",
    reveal: null,
    daily_progress: null,
    completed_now: false,
    points_earned: 0,
    ...over,
  };
}

async function typeAnswer(text: string) {
  const input = screen.queryByLabelText("빈칸에 들어갈 말") ?? null;
  if (!input) await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
  await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), `${text}{Enter}`);
}

describe("SessionConversation — adaptive session", () => {
  beforeEach(() => {
    study.start.mockResolvedValue(sessionWith([activity("act_1"), activity("act_2")]));
  });

  it("takes its items from the session and grades answers on the session, not the recommender", async () => {
    study.attempt.mockResolvedValue(
      studyResult({ correct: true, activity_status: "completed", attempts_left: 0, reveal: REVEAL, points_earned: 10 }),
    );
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    expect(recSentences).not.toHaveBeenCalled();
    expect(study.start).toHaveBeenCalledWith(expect.objectContaining({ track: "conversation", activity_count: 3 }));
    await waitFor(() => expect(study.present).toHaveBeenCalledWith("ss_1", "act_1"));

    await typeAnswer("지내고");
    await waitFor(() =>
      expect(study.attempt).toHaveBeenCalledWith("ss_1", "act_1", expect.objectContaining({ answer: "지내고" })),
    );
    expect(blankAttempt).not.toHaveBeenCalled();
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
    // The solved card shows the full sentence, known only from the reveal.
    expect(screen.getByText("덕분에 잘 지내고 있어요.")).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("1/2");
  });

  it("after the second wrong answer shows the answer, and a typed practice answer moves on without credit", async () => {
    study.attempt
      .mockResolvedValueOnce(studyResult({}))
      .mockResolvedValueOnce(
        studyResult({ attempt_no: 2, activity_status: "completed", attempts_left: 0, reveal: REVEAL, evidence_policy: "retry" }),
      );
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await typeAnswer("몰라");
    await screen.findByText("다시 생각해보세요");
    await typeAnswer("모르겠어");
    await waitFor(() => expect(toastShow).toHaveBeenCalledWith(expect.stringContaining("정답")));
    // The answer is shown in the blank.
    await waitFor(() => expect(screen.getByLabelText("빈칸에 들어갈 말")).toHaveAttribute("placeholder", "지내고"));

    // Typing it is practice: checked locally, not sent, not counted correct.
    await typeAnswer("지내고");
    expect(await screen.findByText("정답이에요!")).toBeInTheDocument();
    expect(study.attempt).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("counter")).toHaveTextContent("0/2");
  });

  it("the hint chip takes the session hint, and 정답보기 reveals through the session", async () => {
    study.hint.mockResolvedValue({ hint: null, revealed_text: "지" });
    study.reveal.mockResolvedValue(REVEAL);
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = screen.getByLabelText("빈칸에 들어갈 말");
    await userEvent.click(screen.getByRole("button", { name: /힌트보기/ }));
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "지"));
    expect(study.hint).toHaveBeenCalledWith("ss_1", "act_1");
    await userEvent.click(screen.getByRole("button", { name: /정답보기/ }));
    await waitFor(() => expect(input).toHaveAttribute("placeholder", "지내고"));
    expect(study.reveal).toHaveBeenCalledWith("ss_1", "act_1");
    expect(blankHint).not.toHaveBeenCalled();
  });

  it("a hint on a session that has ended starts a fresh session instead of failing", async () => {
    study.hint.mockRejectedValueOnce(new ApiError(409, "session.not_active", ""));
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    expect(study.start).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /힌트보기/ }));
    await waitFor(() => expect(study.start).toHaveBeenCalledTimes(2));
    expect(toastError).not.toHaveBeenCalled();
  });

  it("the prompt panel customizes the rest of the session instead of regenerating it", async () => {
    const replaced = activity("act_3", { content: { ...activity("act_3").content, display_text: "커피 ___ 주세요.", translation: "Coffee, please." } });
    study.customize.mockResolvedValue({
      customization_id: "cz_1",
      status: "applied",
      operation: "replace_remaining",
      interpreter_route: "rule_based",
      fallback_step: "exact",
      unmet_constraints: [],
      message: { ko: "카페 상황으로 바꿨어요.", en: "Switched to café situations." },
      new_revision: 2,
      added_activity_ids: ["act_3"],
      removed_activity_ids: ["act_2"],
      session: sessionWith([activity("act_1"), replaced], 2),
    });
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.type(screen.getByLabelText("맞춤 문장 상황 입력"), "카페에서 쓰는 표현");
    await userEvent.click(screen.getByRole("button", { name: "맞춤 문장 추천 받기" }));
    await waitFor(() =>
      expect(study.customize).toHaveBeenCalledWith(
        "ss_1",
        expect.objectContaining({ prompt: "카페에서 쓰는 표현", expected_revision: 1 }),
      ),
    );
    expect(toastSuccess).toHaveBeenCalledWith("카페 상황으로 바꿨어요.");
    expect(recSentences).not.toHaveBeenCalled();
    // The current item stays; the replaced one is gone from the set.
    expect(screen.getByText(/덕분에 잘/)).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/2");
  });

  it("an unmet customization request says so and leaves the session as it is", async () => {
    study.customize.mockResolvedValue({
      customization_id: "cz_2",
      status: "needs_clarification",
      operation: null,
      interpreter_route: "rule_based",
      fallback_step: "clarify",
      unmet_constraints: ["topic"],
      message: { ko: "어떤 상황을 원하는지 조금 더 알려 주세요.", en: "Tell me a bit more." },
      new_revision: null,
      added_activity_ids: [],
      removed_activity_ids: [],
      session: sessionWith([activity("act_1"), activity("act_2")]),
    });
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.type(screen.getByLabelText("맞춤 문장 상황 입력"), "음");
    await userEvent.click(screen.getByRole("button", { name: "맞춤 문장 추천 받기" }));
    await waitFor(() => expect(toastShow).toHaveBeenCalledWith("어떤 상황을 원하는지 조금 더 알려 주세요."));
  });

  it("a regular member sees the request field locked and a tap only explains why (TAL-008)", async () => {
    mockMe = { app_language: "ko", membership: FREE };
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    expect(screen.queryByLabelText("맞춤 문장 상황 입력")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "맞춤 문장 추천 받기" })).not.toBeInTheDocument();
    expect(screen.getByText("★ 프리미엄 전용")).toBeInTheDocument();
    const field = screen.getByRole("button", { name: /원하는 상황을 입력하면/ });
    expect(field).toHaveTextContent("🔒 원하는 상황을 입력하면 맞춤 문장을 추천해드려요");
    expect(field).not.toHaveTextContent("✨");
    await userEvent.click(field);
    expect(toastShow).toHaveBeenCalledWith("프리미엄 회원만 이용할 수 있는 기능이에요.");
    expect(study.customize).not.toHaveBeenCalled();
  });

  it("anchors the AI help to the tutor for the current activity", async () => {
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    const ctx = JSON.parse(screen.getByTestId("ask-context").textContent!);
    expect(ctx).toMatchObject({ contextKind: "study_activity", sessionId: "ss_1", contextId: "act_1", autoExplain: false });
  });

  it("a refresh resumes the same server session and keeps progress from the server", async () => {
    study.start.mockResolvedValue(
      sessionWith([
        activity("act_1", { status: "completed", attempts: [{ attempt_no: 1, correct: true, graded_at: "" }], reveal: REVEAL }),
        activity("act_2", { content: { ...activity("act_2").content, display_text: "내일 ___ 만나요." } }),
      ]),
    );
    renderScreen();
    // Resumes at the first open activity with the server's progress.
    expect(await screen.findByText(/내일/)).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("1/2");
    expect(recSentences).not.toHaveBeenCalled();
  });
});
