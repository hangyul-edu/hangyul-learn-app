import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readSavedTab, type SavedOrigin } from "../lib/savedReturn";

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

const { get, attempt, bookmark, unbookmark, audio, recordActivity } = vi.hoisted(() => ({
  get: vi.fn(),
  attempt: vi.fn(),
  bookmark: vi.fn(),
  unbookmark: vi.fn(),
  audio: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  quizApi: { get, attempt, bookmark, unbookmark, audio },
  learnApi: { recordActivity },
}));

import { SessionReview } from "./SessionReview";
import { I18nProvider } from "../i18n";

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

const SAVED_ORIGIN: SavedOrigin = { savedKey: "k-saved", tab: "problem", source: "wrong" };

function renderReview() {
  const router = createMemoryRouter(
    [
      { path: "/review/question/:quizId", element: <SessionReview /> },
      { path: "/saved", element: <SavedProbe /> },
    ],
    {
      initialEntries: [
        { pathname: "/saved", state: { marker: "origin" } },
        // Saved hands the review the category and feed it was opened from, so
        // 완료 / back return to THAT view rather than a fixed one.
        { pathname: "/review/question/q1", state: SAVED_ORIGIN },
      ],
      initialIndex: 1,
    },
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  get.mockResolvedValue(QUIZ);
  recordActivity.mockResolvedValue({ studied_today: true, learning_day_created: true, total_learning_days: 1 });
});
afterEach(() => vi.restoreAllMocks());

describe("SessionReview — study activity", () => {
  it("records a TOPIK activity once when the saved question is displayed, before any answer", async () => {
    renderReview();
    await screen.findByText(/알맞은 것을 고르십시오/);
    await waitFor(() => expect(recordActivity).toHaveBeenCalledTimes(1));
    expect(recordActivity).toHaveBeenCalledWith("topik", "q1");
    expect(attempt).not.toHaveBeenCalled();
  });

  it("records nothing when the question fails to load", async () => {
    get.mockRejectedValue(new Error("nope"));
    renderReview();
    await waitFor(() => expect(get).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(recordActivity).not.toHaveBeenCalled();
  });
});

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
    expect(screen.getByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
    // The Submit button stays in the DOM but hidden, so the vertically-centered
    // card keeps its height (no downward shift) as the sheet slides up — it is
    // reserved, not removed.
    const submitEl = document.querySelector<HTMLButtonElement>(".sess__submit");
    expect(submitEl).not.toBeNull();
    expect(submitEl!.style.visibility).toBe("hidden");
    expect(screen.queryByRole("button", { name: "제출" })).not.toBeInTheDocument();
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
    // ...and Saved is told to come back up on Questions, so a TOPIK review never
    // lands the user on Saved Sentences (survives a refresh mid-session, which
    // wipes the module hint but not this route's state).
    expect(readSavedTab(SAVED_ORIGIN.savedKey)).toBe("problem");
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

  it("offers 다시 풀기 — never a listening-only replay — for a listening question", async () => {
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

    expect(await screen.findByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 듣기" })).not.toBeInTheDocument();
  });

  it("다시 풀기 re-arms a listening question instead of replaying its audio", async () => {
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
    await userEvent.click(await screen.findByRole("button", { name: "다시 풀기" }));

    // Same reset as a reading item: the sheet closes, the question is answerable
    // again, and no audio playback was kicked off.
    expect(screen.queryByRole("button", { name: "완료" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "제출" })).toBeDisabled();
    expect(audio).not.toHaveBeenCalled();
  });

  it("offers the same 다시 풀기 sheet for a writing question", async () => {
    get.mockResolvedValue({
      ...QUIZ,
      quiz_id: "q3",
      question_type: "writing_fill_blanks",
      prompt: "빈칸에 알맞은 말을 쓰십시오.",
      answer: { format: "short_answer", choices: [], blanks: [{ key: "1", answer: "덕분에" }] },
    });
    attempt.mockResolvedValue({
      attempt_id: "a4",
      correct: true,
      points_earned: 5,
      status: "graded",
      writing: { score: 9, max_score: 10, suggestions: [], grammar_issues: [], corrected_text: null },
    });
    renderReview();
    await userEvent.type(await screen.findByRole("textbox"), "덕분에");
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    expect(await screen.findByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다시 듣기" })).not.toBeInTheDocument();
  });

  it("completes a scored essay, whose result is never right or wrong", async () => {
    // Regression: the server sends `correct: null` for writing, and only a
    // truthy `correct` completed the item — so an essay review had no sheet,
    // kept Submit live, and was treated as a wrong answer.
    get.mockResolvedValue({
      ...QUIZ,
      quiz_id: "q4",
      question_type: "writing_opinion_essay",
      prompt: "다음을 주제로 글을 쓰십시오.",
      answer: { format: "free_response", choices: [], blanks: [], min_length: 1, max_length: 700 },
    });
    attempt.mockResolvedValue({
      attempt_id: "a5",
      correct: null,
      points_earned: 5,
      status: "graded",
      writing: { score: 30, max_score: 50, suggestions: [], grammar_issues: [], corrected_text: null },
    });
    renderReview();
    await userEvent.type(await screen.findByRole("textbox"), "저는 한국어를 좋아합니다.");
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    expect(await screen.findByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
    // Submit is retired (hidden, disabled) — the essay can't be re-sent.
    expect(document.querySelector<HTMLButtonElement>(".sess__submit")).toBeDisabled();
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

  const option = (text: string) => screen.getByRole("radio", { name: new RegExp(text) });

  it("does not reveal the correct option on an incorrect answer", async () => {
    attempt.mockResolvedValue({ attempt_id: "a", correct: false, correct_answer: "1", status: "graded" });
    renderReview();
    await screen.findAllByRole("radio");
    await userEvent.click(option("동안")); // key "2"
    await userEvent.click(screen.getByRole("button", { name: "제출" }));

    await waitFor(() => expect(option("동안").className).toContain("is-wrong"));
    // The correct option (key "1" = "덕분에") must NOT be revealed blue.
    expect(option("덕분에").className).not.toContain("is-correct");
  });

  it("highlights only the most recently submitted wrong option", async () => {
    attempt.mockResolvedValue({ attempt_id: "a", correct: false, correct_answer: "1", status: "graded" });
    renderReview();
    await screen.findAllByRole("radio");

    await userEvent.click(option("동안")); // key "2"
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await waitFor(() => expect(option("동안").className).toContain("is-wrong"));

    // Selecting a different option clears the previous wrong highlight at once.
    await userEvent.click(option("처럼")); // key "3"
    expect(option("동안").className).not.toContain("is-wrong");

    // Submitting the new wrong option highlights only it — the first is neutral.
    await userEvent.click(screen.getByRole("button", { name: "제출" }));
    await waitFor(() => expect(option("처럼").className).toContain("is-wrong"));
    expect(option("동안").className).not.toContain("is-wrong");
  });

  it("starts with no option selected even if a stale MC draft is persisted", async () => {
    sessionStorage.setItem("hangyul.review.quiz.q1", JSON.stringify({ choiceKey: "2" }));
    renderReview();
    const radios = await screen.findAllByRole("radio");
    for (const r of radios) expect(r).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "제출" })).toBeDisabled();
  });
});
