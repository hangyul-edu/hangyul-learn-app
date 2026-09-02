import { describe, expect, it, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useNavigate } from "react-router-dom";
import type { Quiz } from "../lib/types";

vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { user_id: "u1", app_language: "ko" } }) }));

const { savedSentences, bookmarks, quizMarkViewed } = vi.hoisted(() => ({
  savedSentences: vi.fn(),
  bookmarks: vi.fn(),
  quizMarkViewed: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  sentenceApi: {
    saved: savedSentences,
    audio: vi.fn(),
    markViewed: vi.fn(() => Promise.resolve()),
    clearAutoSave: vi.fn(() => Promise.resolve()),
    unbookmark: vi.fn(() => Promise.resolve()),
  },
  quizApi: {
    bookmarks,
    markViewed: quizMarkViewed,
    unbookmark: vi.fn(() => Promise.resolve()),
  },
}));

import { Saved } from "./Saved";
import { I18nProvider } from "../i18n";

const QUIZ = {
  quiz_id: "q1",
  level: 3,
  topik_section: "reading",
  prompt: "( )에 알맞은 것을 고르십시오.",
} as unknown as Quiz;

beforeEach(() => {
  vi.clearAllMocks();
  savedSentences.mockResolvedValue({ items: [], next_cursor: null });
  bookmarks.mockResolvedValue({ items: [QUIZ], next_cursor: null });
  quizMarkViewed.mockResolvedValue(undefined);
});

// The single-item review screen: its back chevron pops history (nav(-1)).
function ReviewStub() {
  const nav = useNavigate();
  return <button onClick={() => nav(-1)}>back-to-saved</button>;
}

// Renders a realistic history [origin, /saved] and mounts under StrictMode so the
// dev mount→unmount→mount double-invoke is exercised — the exact condition that
// broke the earlier consume-once restore.
function renderRoundTrip(savedEntry: string | { pathname: string; state?: unknown }) {
  const router = createMemoryRouter(
    [
      { path: "/saved", element: <Saved /> },
      { path: "/review/question/:quizId", element: <ReviewStub /> },
    ],
    { initialEntries: ["/home", savedEntry], initialIndex: 1 },
  );
  return render(
    <I18nProvider language="ko">
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    </I18nProvider>,);
}

async function switchToQuestionsAndOpenReview() {
  const modeBtn = await screen.findByRole("button", { name: /저장한 (문장|문제)/ });
  await userEvent.click(modeBtn);
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "저장한 문제" }));
  await userEvent.click(await screen.findByRole("button", { name: /문제 복습하기/ }));
  await screen.findByText("back-to-saved");
}

async function expectQuestionsTab() {
  expect(await screen.findByRole("button", { name: /저장한 문제/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /저장한 문장/ })).not.toBeInTheDocument();
}

describe("Saved — Questions tab restored when returning from a review", () => {
  it("restores Questions on back, surviving the StrictMode double-mount", async () => {
    renderRoundTrip("/saved"); // reached from Home (no nav state)
    await switchToQuestionsAndOpenReview();
    await userEvent.click(screen.getByRole("button", { name: "back-to-saved" }));
    await expectQuestionsTab();
  });

  it("restores Questions even when the /saved entry's nav state says Sentences", async () => {
    // Personalized opens /saved with state { tab: "sentence" } — the stale state
    // must not override the tab the user actually left on.
    renderRoundTrip({ pathname: "/saved", state: { tab: "sentence" } });
    await switchToQuestionsAndOpenReview();
    await userEvent.click(screen.getByRole("button", { name: "back-to-saved" }));
    await expectQuestionsTab();
  });
});
