/**
 * Screens that DISPLAY a Conversation sentence or a TOPIK question record study
 * activity (POST /learning/activity) once; list screens never do.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";

const api = vi.hoisted(() => ({
  recordActivity: vi.fn(),
  quizGet: vi.fn(),
  quizDaily: vi.fn(),
  quizList: vi.fn(),
  sentenceList: vi.fn(),
  examGet: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { recordActivity: api.recordActivity },
  quizApi: { get: api.quizGet, daily: api.quizDaily, list: api.quizList },
  sentenceApi: { list: api.sentenceList },
  examApi: { get: api.examGet },
}));

import { I18nProvider } from "../i18n";
import { ToastProvider } from "../hooks/toast";
import { QuizPlay } from "./QuizPlay";
import { Topik } from "./Topik";
import { Conversation } from "./Conversation";
import { ExamPlay } from "./Exams";

const QUIZ = {
  quiz_id: "q-1",
  prompt: "알맞은 것을 고르십시오.",
  level: 3,
  topik_section: "reading",
  answer: { format: "single_choice", choices: [{ key: "a", text: "가" }, { key: "b", text: "나" }] },
};
const SENTENCE = { sentence_id: "s-1", korean: "안녕하세요", translation: "Hello", level: 1 };

function renderAt(path: string, pattern: string, el: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={pattern} element={el} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  const r = render(tree);
  return { ...r, rerenderSame: () => r.rerender(tree) };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.recordActivity.mockResolvedValue({ studied_today: true, learning_day_created: true, total_learning_days: 1 });
  api.quizGet.mockResolvedValue(QUIZ);
  api.quizDaily.mockResolvedValue({ date: "2026-09-29", questions: [QUIZ] });
  api.quizList.mockResolvedValue({ items: [QUIZ], next_cursor: null });
  api.sentenceList.mockResolvedValue({ items: [SENTENCE], next_cursor: null });
  api.examGet.mockResolvedValue({ exam_id: "e-1", title: "모의고사", questions: [QUIZ] });
});

describe("study activity on display", () => {
  it("QuizPlay records a TOPIK activity once when the question appears, not on re-render", async () => {
    const r = renderAt("/quiz/q-1", "/quiz/:quizId", <QuizPlay />);
    await screen.findByText(QUIZ.prompt);
    await waitFor(() => expect(api.recordActivity).toHaveBeenCalledTimes(1));
    expect(api.recordActivity).toHaveBeenCalledWith("topik", "q-1");
    r.rerenderSame();
    r.rerenderSame();
    expect(api.recordActivity).toHaveBeenCalledTimes(1);
  });

  it("Conversation records a conversation activity once the sentence is shown", async () => {
    renderAt("/learn/conversation", "/learn/conversation", <Conversation />);
    await screen.findByText(SENTENCE.korean);
    await waitFor(() => expect(api.recordActivity).toHaveBeenCalledTimes(1));
    expect(api.recordActivity).toHaveBeenCalledWith("conversation", "s-1");
  });

  it("ExamPlay records a TOPIK activity for the displayed exam question", async () => {
    renderAt("/exams/e-1", "/exams/:examId", <ExamPlay />);
    await screen.findByText(QUIZ.prompt);
    await waitFor(() => expect(api.recordActivity).toHaveBeenCalledTimes(1));
    expect(api.recordActivity).toHaveBeenCalledWith("topik", "q-1");
  });

  it("does not record while the question is still loading", () => {
    api.quizGet.mockReturnValue(new Promise(() => undefined));
    renderAt("/quiz/q-1", "/quiz/:quizId", <QuizPlay />);
    expect(api.recordActivity).not.toHaveBeenCalled();
  });

  it("the TOPIK list screen (a list load, not studying) records nothing", async () => {
    renderAt("/learn/topik", "/learn/topik", <Topik />);
    expect((await screen.findAllByText(QUIZ.prompt)).length).toBeGreaterThan(0);
    expect(api.recordActivity).not.toHaveBeenCalled();
  });

  it("a failed record is silent — the question stays usable", async () => {
    api.recordActivity.mockRejectedValue(new Error("offline"));
    renderAt("/quiz/q-1", "/quiz/:quizId", <QuizPlay />);
    await screen.findByText(QUIZ.prompt);
    await waitFor(() => expect(api.recordActivity).toHaveBeenCalledTimes(1));
    expect(screen.getByText(QUIZ.prompt)).toBeInTheDocument();
  });
});
