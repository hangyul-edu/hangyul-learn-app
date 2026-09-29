import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { get, attempt, recordActivity } = vi.hoisted(() => ({
  get: vi.fn(),
  attempt: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  quizApi: { get, attempt, audio: vi.fn() },
  learnApi: { recordActivity },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { QuizPlay } from "./QuizPlay";
import { I18nProvider } from "../i18n";

const MC = {
  quiz_id: "q1",
  prompt: "알맞은 것을 고르십시오.",
  level: 3,
  topik_section: "reading",
  material: { kind: "text", html: null, image_url: null, audio: null },
  answer: {
    format: "single_choice",
    choices: [
      { key: "1", text: "덕분에" },
      { key: "2", text: "동안" },
    ],
    blanks: [],
  },
};

function renderQuiz() {
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/quiz/q1"]}>
          <Routes>
            <Route path="/quiz/:quizId" element={<QuizPlay />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  recordActivity.mockResolvedValue({});
});

describe("QuizPlay result", () => {
  it("shows the XP the server reports as xp_earned", async () => {
    // Regression: the badge read `xp_awarded`, which the server never sends.
    get.mockResolvedValue(MC);
    attempt.mockResolvedValue({ attempt_id: "a1", correct: true, status: "graded", xp_earned: 10, points_earned: 0 });
    renderQuiz();
    await userEvent.click(await screen.findByText("덕분에"));
    await userEvent.click(screen.getByRole("button", { name: "제출하기" }));
    expect(await screen.findByText("+10 XP")).toBeInTheDocument();
  });

  it("scores a writing answer instead of calling it wrong", async () => {
    // Regression: the score was read from a top-level `score` (it lives under
    // `writing`), and `correct: null` rendered the 아쉬워요 verdict.
    get.mockResolvedValue({
      ...MC,
      answer: { format: "free_response", choices: [], blanks: [], min_length: 1, max_length: 700 },
    });
    attempt.mockResolvedValue({
      attempt_id: "a2",
      correct: null,
      status: "graded",
      xp_earned: 0,
      points_earned: 0,
      writing: { score: 42, max_score: 50, grammar_issues: [], suggestions: [] },
    });
    renderQuiz();
    await userEvent.type(await screen.findByRole("textbox"), "저는 한국어를 좋아합니다.");
    await userEvent.click(screen.getByRole("button", { name: "제출하기" }));
    expect(await screen.findByText("채점 42점")).toBeInTheDocument();
    expect(screen.queryByText("아쉬워요 😢")).not.toBeInTheDocument();
  });
});
