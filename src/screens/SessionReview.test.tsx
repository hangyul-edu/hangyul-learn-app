import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) => (
    <div>
      <button aria-label="뒤로" onClick={onBack}>
        back
      </button>
      {children}
    </div>
  ),
}));

// The saved list, tagged with a marker carried on the ORIGIN history entry.
// Leaving the review must pop back to that same entry (history-back), not push a
// fresh /saved — otherwise the marker is absent and Saved's own back would loop
// into the review.
function SavedProbe() {
  const loc = useLocation();
  const marker = (loc.state as { marker?: string } | null)?.marker ?? "fresh";
  return <div>SAVED[{marker}]</div>;
}
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

const { get, attempt, bookmark, unbookmark, audio } = vi.hoisted(() => ({
  get: vi.fn(),
  attempt: vi.fn(),
  bookmark: vi.fn(),
  unbookmark: vi.fn(),
  audio: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  quizApi: { get, attempt, bookmark, unbookmark, audio },
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
      { path: "/saved", element: <SavedProbe /> },
    ],
    {
      initialEntries: [
        { pathname: "/saved", state: { marker: "origin" } },
        "/review/question/q1",
      ],
      initialIndex: 1,
    },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
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
    // The instruction shows for every question: the heading + the per-question
    // prompt (regression guard — both vanished during the result-state redesign).
    expect(await screen.findByText(/알맞은 것을 고르십시오/)).toBeInTheDocument();
    expect(screen.getByText("문제를 풀어보세요")).toBeInTheDocument();
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

  it("back button pops to the origin Saved entry (no new entry / loop)", async () => {
    renderReview();
    await screen.findByText(/알맞은 것을 고르십시오/);
    await userEvent.click(screen.getByRole("button", { name: "뒤로" }));
    // Popped to the exact entry we came from — a pushed /saved would read "fresh".
    expect(await screen.findByText("SAVED[origin]")).toBeInTheDocument();
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
    expect(await screen.findByText("SAVED[origin]")).toBeInTheDocument();
  });

  it("focuses the confirm button and dismisses the reward modal on Escape", async () => {
    attempt.mockResolvedValue({ attempt_id: "a1", correct: true, points_earned: 5, status: "graded" });
    renderReview();
    await userEvent.click((await screen.findAllByRole("radio"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await userEvent.click(await screen.findByRole("button", { name: "완료" }));

    expect(await screen.findByRole("button", { name: "확인" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(await screen.findByText("SAVED[origin]")).toBeInTheDocument();
  });

  it("uses '다시 듣기' (not '다시 시작') as the left button for a listening question", async () => {
    get.mockResolvedValue({
      ...QUIZ,
      quiz_id: "q2",
      question_type: "listening_multiple_choice",
      prompt: "대화를 듣고 알맞은 것을 고르십시오.",
      material: { kind: "audio", html: null, image_url: null, audio: null },
    });
    attempt.mockResolvedValue({ attempt_id: "a3", correct: true, points_earned: 5, status: "graded" });
    renderReview();
    await userEvent.click((await screen.findAllByRole("radio"))[0]);
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    expect(await screen.findByRole("button", { name: "다시 듣기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 시작" })).not.toBeInTheDocument();
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
