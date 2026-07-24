import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

/* ---- mocks: keep the heavy session chrome out of the way ---- */
vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/SessionCompleteModal", () => ({ SessionCompleteModal: () => null }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));

let mockMe: { app_language: string } = { app_language: "ko" };
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: mockMe }) }));

const { recSentences, blankAttempt, blankHint, summary } = vi.hoisted(() => ({
  recSentences: vi.fn(),
  blankAttempt: vi.fn(),
  blankHint: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { sentences: recSentences },
  sentenceApi: {
    blankAttempt,
    blankHint,
    speechAttempt: vi.fn(),
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
    audio: vi.fn().mockResolvedValue({ url: "http://x/a.mp3" }),
  },
  dashboardApi: { summary },
  learnApi: { recordSession: vi.fn() },
}));

import { SessionConversation } from "./SessionConversation";

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
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMe = { app_language: "ko" };
  summary.mockResolvedValue({
    tracks: [{ category: "conversation", level: 3, goal: { target: 3, current: 0, achieved: false } }],
  });
  recSentences.mockResolvedValue({ items: [SENTENCE] });
});
afterEach(() => vi.restoreAllMocks());

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

  it("keyboard mode swaps the blank for a focused input; empty input can't submit", async () => {
    renderScreen();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    const input = await screen.findByLabelText("빈칸에 들어갈 말");
    expect(input).toBeInTheDocument();
    // Mode button now offers to switch back to voice.
    expect(screen.getByRole("button", { name: /음성 모드/ })).toBeInTheDocument();
    // Empty → the confirm button is disabled.
    expect(screen.getByRole("button", { name: "답 확인" })).toBeDisabled();
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
    // Typing replaces the placeholder; only the typed text is submitted.
    await userEvent.type(input, "지내고");
    expect(input.value).toBe("지내고");
    await userEvent.click(screen.getByRole("button", { name: "답 확인" }));
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
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고");
    await userEvent.click(screen.getByRole("button", { name: "답 확인" }));

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
  await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고");
  await userEvent.click(screen.getByRole("button", { name: "답 확인" }));
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
