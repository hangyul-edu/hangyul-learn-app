import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const { daily, list } = vi.hoisted(() => ({ daily: vi.fn(), list: vi.fn() }));
vi.mock("../api/endpoints", () => ({ quizApi: { daily, list } }));

import { Topik } from "./Topik";
import { I18nProvider } from "../i18n";

const quiz = (id: string) => ({
  quiz_id: id,
  prompt: `오늘의 문제 ${id}`,
  level: 3,
  topik_section: "reading",
  material: { kind: "text", html: null, image_url: null, audio: null },
  answer: { format: "single_choice", choices: [], blanks: [] },
});

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ items: [], next_cursor: null });
});

describe("Topik — today's questions", () => {
  it("lists the daily set from `questions`", async () => {
    // Regression: the screen read `items`, but GET /quizzes/daily returns
    // { date, questions }, so today's set always showed the error line.
    daily.mockResolvedValue({ date: "2026-09-29", questions: [quiz("d1"), quiz("d2")] });
    render(
      <I18nProvider language="ko">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <Topik />
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );
    expect(await screen.findByText("오늘의 문제 d1")).toBeInTheDocument();
    expect(screen.getByText("오늘의 문제 d2")).toBeInTheDocument();
  });
});
