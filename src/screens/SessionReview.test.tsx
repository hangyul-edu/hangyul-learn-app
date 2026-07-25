import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

const { get, attempt, bookmark, unbookmark } = vi.hoisted(() => ({
  get: vi.fn(),
  attempt: vi.fn(),
  bookmark: vi.fn(),
  unbookmark: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  quizApi: { get, attempt, bookmark, unbookmark },
}));

import { SessionReview } from "./SessionReview";

const QUIZ = {
  quiz_id: "q1",
  question_type: "reading_multiple_choice",
  prompt: "(   )에 알맞은 것을 고르십시오.",
  level: 3,
  material: { kind: "text", html: null, image_url: null, audio: null },
  answer: {
    format: "single_choice",
    choices: [
      { key: "1", text: "덕분에" },
      { key: "2", text: "동안" },
      { key: "3", text: "처럼" },
      { key: "4", text: "만큼" },
    ],
    blanks: [],
  },
  is_favorited: true,
};

function renderReview() {
  const router = createMemoryRouter(
    [
      { path: "/review/question/:quizId", element: <SessionReview /> },
      { path: "/saved", element: <div>SAVED LIST</div> },
    ],
    { initialEntries: ["/review/question/q1"] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  get.mockResolvedValue(QUIZ);
});
afterEach(() => vi.restoreAllMocks());

describe("SessionReview — saved TOPIK question", () => {
  it("renders the exact saved question via the TOPIK renderer", async () => {
    renderReview();
    expect(await screen.findByText(/알맞은 것을 고르십시오/)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(get).toHaveBeenCalledWith("q1");
  });

  it("submits with source 'review' and opens the two-button completion sheet on correct", async () => {
    attempt.mockResolvedValue({ attempt_id: "a1", correct: true, points_earned: 5, status: "graded" });
    renderReview();
    await userEvent.click((await screen.findAllByRole("radio"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    expect(attempt).toHaveBeenCalledWith(
      "q1",
      expect.objectContaining({ answer: "1", source: "review", elapsed_ms: expect.any(Number) }),
    );
    // Two-button sheet, no next.
    expect(await screen.findByRole("button", { name: "완료" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시작" })).toBeInTheDocument();
  });

  it("finalizes on 완료: shows the reward modal with the server points, then returns to the saved list", async () => {
    attempt.mockResolvedValue({ attempt_id: "a1", correct: true, points_earned: 5, status: "graded" });
    renderReview();
    await userEvent.click((await screen.findAllByRole("radio"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await userEvent.click(await screen.findByRole("button", { name: "완료" }));

    expect(await screen.findByText("복습 완료!")).toBeInTheDocument();
    expect(screen.getByText("+5P")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText("SAVED LIST")).toBeInTheDocument();
  });

  it("an incorrect answer stays on the item with no sheet and allows retry", async () => {
    attempt.mockResolvedValue({
      attempt_id: "a2",
      correct: false,
      correct_answer: "1",
      status: "graded",
    });
    renderReview();
    await userEvent.click((await screen.findAllByRole("radio"))[1]);
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    // Feedback shown; no completion sheet; submit stays for an immediate retry.
    expect(await screen.findByText(/아쉬워요|정답: 1/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "완료" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제출" })).toBeInTheDocument();
  });
});
