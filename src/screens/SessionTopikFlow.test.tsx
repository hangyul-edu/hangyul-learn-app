import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

// Surface the SessionChrome progress props so the test can assert the counter +
// bar directly (correct/total = numerator/denominator, progress = 0..1).
vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({
    correct,
    total,
    progress,
    children,
  }: {
    correct: number;
    total: number;
    progress: number;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="counter">
        {correct}/{total}
      </div>
      <div data-testid="progress">{Math.round(progress * 100)}</div>
      {children}
    </div>
  ),
}));
vi.mock("../components/SessionCompleteModal", () => ({
  SessionCompleteModal: ({ correctCount, points }: { correctCount: number; points: number }) => (
    <div data-testid="complete">완료 {correctCount} {points}P</div>
  ),
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

const { questions, topikTypes, summary, attempt, recordSession } = vi.hoisted(() => ({
  questions: vi.fn(),
  topikTypes: vi.fn(),
  summary: vi.fn(),
  attempt: vi.fn(),
  recordSession: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { questions, topikQuestionTypes: topikTypes },
  quizApi: { attempt, audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
  dashboardApi: { summary },
  learnApi: { recordSession },
}));

import { SessionTopik } from "./SessionTopik";
import { I18nProvider } from "../i18n";

function mc(id: string) {
  return {
    quiz_id: id,
    question_type: "reading_multiple_choice",
    prompt: `문제 ${id}`,
    level: 3,
    material: { kind: "text", html: null, image_url: null, audio: null },
    answer: {
      format: "single_choice",
      choices: [
        { key: "1", text: "선택 1" },
        { key: "2", text: "선택 2" },
        { key: "3", text: "선택 3" },
        { key: "4", text: "선택 4" },
      ],
      blanks: [],
    },
  };
}

// Attempt responses the mocked server returns.
const wrongRes = (id: string) => ({
  attempt_id: `att-w-${id}`,
  correct: false,
  status: "graded",
  points_earned: 0,
  completed_now: false,
  correct_answer: "1",
  daily_progress: { target: 3, current: 0, achieved: false },
});
const correctRes = (id: string, current: number) => ({
  attempt_id: `att-c-${id}`,
  correct: true,
  status: "graded",
  points_earned: 10,
  completed_now: true,
  daily_progress: { target: 3, current, achieved: current >= 3 },
});
// A retry re-answer: the server dedups within the session, so it grades correct
// but awards nothing and leaves the goal count unchanged (completed_now false).
const retryRes = (id: string) => ({
  attempt_id: `att-r-${id}`,
  correct: true,
  status: "graded",
  points_earned: 0,
  completed_now: false,
  daily_progress: { target: 3, current: 3, achieved: true },
});

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <SessionTopik /> }], {
    initialEntries: [{ pathname: "/", state: { section: "reading" } }],
  });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,);
}

const submitBtn = () => screen.getByRole("button", { name: "제출" });
const option = (key: string) => screen.getByRole("radio", { name: new RegExp(`선택 ${key}`) });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  summary.mockResolvedValue({
    tracks: [{ category: "topik", level: 3, goal: { target: 3, current: 0, achieved: false } }],
  });
  topikTypes.mockResolvedValue({ section: "reading", items: [] });
  questions.mockResolvedValue({ items: [mc("A"), mc("B"), mc("C")] });
});

describe("SessionTopik — answer flow (incorrect → retry → correct)", () => {
  it("starts with Submit disabled and no progress", async () => {
    renderScreen();
    await screen.findByText("문제 A");
    // The question instruction is shown for every question (regression guard):
    // the heading before answering + the per-question prompt below it.
    expect(screen.getByText("문제를 풀어보세요")).toBeInTheDocument();
    expect(screen.getByText("문제 A")).toBeInTheDocument();
    expect(submitBtn()).toBeDisabled();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/3");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
  });

  it("selecting an option enables Submit but does not change progress", async () => {
    renderScreen();
    await screen.findByText("문제 A");
    await userEvent.click(option("2"));
    expect(submitBtn()).toBeEnabled();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/3");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
    expect(attempt).not.toHaveBeenCalled(); // no auto-submit
  });

  it("incorrect submission keeps the same question, no progress, and allows immediate retry", async () => {
    attempt.mockResolvedValueOnce(wrongRes("A"));
    renderScreen();
    await screen.findByText("문제 A");

    await userEvent.click(option("2"));
    await userEvent.click(submitBtn());

    // Same question, no progress, Submit still the primary action (not Next).
    expect(await screen.findByText("문제 A")).toBeInTheDocument();
    expect(screen.getByTestId("counter")).toHaveTextContent("0/3");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: /다음|완료/ })).not.toBeInTheDocument();

    // The wrong option is marked red; options stay interactive.
    expect(option("2").className).toContain("is-wrong");

    // Submit is disabled until a DIFFERENT option is chosen…
    expect(submitBtn()).toBeDisabled();
    await userEvent.click(option("3"));
    // …then it re-enables, and the newly selected option is NOT red.
    expect(submitBtn()).toBeEnabled();
    expect(option("3").className).not.toContain("is-wrong");
    expect(option("2").className).toContain("is-wrong"); // prior wrong stays red
  });

  it("a second wrong retry still keeps progress at zero", async () => {
    attempt.mockResolvedValueOnce(wrongRes("A")).mockResolvedValueOnce(wrongRes("A"));
    renderScreen();
    await screen.findByText("문제 A");
    await userEvent.click(option("2"));
    await userEvent.click(submitBtn());
    await userEvent.click(option("3"));
    await userEvent.click(submitBtn());
    await waitFor(() => expect(attempt).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("counter")).toHaveTextContent("0/3");
    expect(screen.getByTestId("progress")).toHaveTextContent("0");
    expect(screen.getByText("문제 A")).toBeInTheDocument();
  });

  it("a correct retry increments progress exactly once and swaps Submit → Next", async () => {
    attempt.mockResolvedValueOnce(wrongRes("A")).mockResolvedValueOnce(correctRes("A", 1));
    renderScreen();
    await screen.findByText("문제 A");

    await userEvent.click(option("2"));
    await userEvent.click(submitBtn());
    await userEvent.click(option("1"));
    await userEvent.click(submitBtn());

    // Server-authoritative progress moved by exactly one; Next appears.
    await waitFor(() => expect(screen.getByTestId("counter")).toHaveTextContent("1/3"));
    expect(screen.getByTestId("progress")).toHaveTextContent("33");
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제출" })).not.toBeInTheDocument();
    // Correct option renders blue; the question is locked (options disabled).
    expect(option("1").className).toContain("is-correct");
    expect(option("3")).toBeDisabled();
  });

  it("the next question loads only after pressing Next", async () => {
    attempt.mockResolvedValueOnce(correctRes("A", 1));
    renderScreen();
    await screen.findByText("문제 A");
    await userEvent.click(option("1"));
    await userEvent.click(submitBtn());

    // Still on A after a correct answer — no auto-advance.
    await screen.findByRole("button", { name: "다음" });
    expect(screen.getByText("문제 A")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("문제 B")).toBeInTheDocument();
    // The new question starts fresh: Submit disabled again.
    expect(submitBtn()).toBeDisabled();
  });

  it("reaching the goal on the final correct answer shows completion", async () => {
    attempt
      .mockResolvedValueOnce(correctRes("A", 1))
      .mockResolvedValueOnce(correctRes("B", 2))
      .mockResolvedValueOnce(correctRes("C", 3));
    renderScreen();

    for (const q of ["A", "B", "C"]) {
      await screen.findByText(`문제 ${q}`);
      await userEvent.click(option("1"));
      await userEvent.click(submitBtn());
      const btn = await screen.findByRole("button", { name: q === "C" ? "완료" : "다음" });
      if (q === "C") {
        // The final step shows the same bottom sheet as Review — 다시 풀기 + 완료.
        const sheet = screen.getByRole("group", { name: "복습 완료!" });
        expect(sheet).toContainElement(btn);
        expect(within(sheet).getByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
      } else {
        // …intermediate answers keep the inline 다음, with no sheet.
        expect(screen.queryByRole("group", { name: "복습 완료!" })).not.toBeInTheDocument();
      }
      await userEvent.click(btn);
    }
    // The first completion finalizes 3 correct answers and 30P (3 × 10).
    expect(await screen.findByTestId("complete")).toHaveTextContent("완료 3 30P");
  });

  it("다시 풀기 re-solves the set without changing the finalized count or points", async () => {
    attempt
      .mockResolvedValueOnce(correctRes("A", 1))
      .mockResolvedValueOnce(correctRes("B", 2))
      .mockResolvedValueOnce(correctRes("C", 3))
      // Retry: the server dedups, so each re-answer earns 0 and doesn't advance.
      .mockResolvedValueOnce(retryRes("A"))
      .mockResolvedValueOnce(retryRes("B"))
      .mockResolvedValueOnce(retryRes("C"));
    renderScreen();
    for (const q of ["A", "B", "C"]) {
      await screen.findByText(`문제 ${q}`);
      await userEvent.click(option("1"));
      await userEvent.click(submitBtn());
      await screen.findByRole("button", { name: q === "C" ? "완료" : "다음" });
      if (q !== "C") await userEvent.click(screen.getByRole("button", { name: "다음" }));
    }
    // Every attempt carries a learning_session_id (server dedups credit by it).
    const sessionId = attempt.mock.calls[0][1].learning_session_id;
    expect(sessionId).toBeTruthy();

    // 다시 풀기 → back to the first question, clean answer state, no summary yet.
    await userEvent.click(screen.getByRole("button", { name: "다시 풀기" }));
    await screen.findByText("문제 A");
    expect(submitBtn()).toBeDisabled();
    expect(screen.queryByTestId("complete")).not.toBeInTheDocument();

    // Re-solve all three; each re-answer reuses the SAME session id and earns 0.
    for (const q of ["A", "B", "C"]) {
      await screen.findByText(`문제 ${q}`);
      await userEvent.click(option("1"));
      await userEvent.click(submitBtn());
      const btn = await screen.findByRole("button", { name: q === "C" ? "완료" : "다음" });
      await userEvent.click(btn);
    }
    const calls = attempt.mock.calls;
    expect(calls[calls.length - 1][1].learning_session_id).toBe(sessionId);
    // The summary still shows the FIRST completion's 3 answers and 30P — the
    // retry earned nothing and must not have zeroed them out.
    expect(await screen.findByTestId("complete")).toHaveTextContent("완료 3 30P");
  });

  it("does not re-submit or double-count on a rapid double-tap of Submit", async () => {
    let resolve!: (v: unknown) => void;
    attempt.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    renderScreen();
    await screen.findByText("문제 A");
    await userEvent.click(option("1"));
    const btn = submitBtn();
    await userEvent.click(btn);
    await userEvent.click(btn); // second tap while the first is in flight
    resolve(correctRes("A", 1));
    await waitFor(() => expect(screen.getByTestId("counter")).toHaveTextContent("1/3"));
    // Exactly one request despite two taps.
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
