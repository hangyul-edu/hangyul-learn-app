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

const { recSentences, blankAttempt, blankHint, summary, recordActivity } = vi.hoisted(() => ({
  recSentences: vi.fn(),
  blankAttempt: vi.fn(),
  blankHint: vi.fn(),
  summary: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { sentences: recSentences },
  sentenceApi: {
    blankAttempt,
    blankHint,
    speechAttempt: vi.fn(),
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
  },
  dashboardApi: { summary },
  learnApi: { recordSession: vi.fn(), recordActivity },
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
  recordActivity.mockResolvedValue({ studied_today: true, learning_day_created: true, total_learning_days: 1 });
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
