import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
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

function renderSaved(entries: (string | { pathname: string; state?: unknown })[], index?: number) {
  const router = createMemoryRouter(
    [
      { path: "/saved", element: <Saved /> },
      { path: "/review/question/:quizId", element: <div>REVIEW</div> },
    ],
    { initialEntries: entries, initialIndex: index },
  );
  return render(<RouterProvider router={router} />);
}

describe("Saved — tab restored across a review round-trip", () => {
  it("returns to the Questions tab even when the list snapshot cannot restore", async () => {
    // Leg 1: Saved opened from Home (a non-default history entry). Switch to the
    // Questions tab and open a saved question — Saved records the leaving tab.
    renderSaved(["/home", "/saved"], 1);
    const modeBtn = await screen.findByRole("button", { name: /저장한 (문장|문제)/ });
    await userEvent.click(modeBtn);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "저장한 문제" }));
    await userEvent.click(await screen.findByRole("button", { name: /문제 복습하기/ }));
    await screen.findByText("REVIEW");
    cleanup();

    // Leg 2: land on a FRESH /saved entry (a different history key → the return
    // snapshot can't be matched). The tab must still come back as Questions, not
    // fall back to the Sentences default.
    renderSaved(["/saved"], 0);
    expect(await screen.findByRole("button", { name: /저장한 문제/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /저장한 문장/ })).not.toBeInTheDocument();
  });

  it("returns to Questions even when the /saved entry's nav state says Sentences", async () => {
    // Leg 1: opened from Personalized, which navigates to /saved with
    // state { tab: "sentence" }. Switch to Questions and open a review.
    renderSaved([{ pathname: "/home" }, { pathname: "/saved", state: { tab: "sentence" } }], 1);
    const modeBtn = await screen.findByRole("button", { name: /저장한 (문장|문제)/ });
    await userEvent.click(modeBtn);
    await userEvent.click(await screen.findByRole("menuitemradio", { name: "저장한 문제" }));
    await userEvent.click(await screen.findByRole("button", { name: /문제 복습하기/ }));
    await screen.findByText("REVIEW");
    cleanup();

    // Leg 2: return to a /saved entry that STILL carries the stale Sentences nav
    // state. The leaving-tab hint must win over that stale state → Questions.
    renderSaved([{ pathname: "/saved", state: { tab: "sentence" } }], 0);
    expect(await screen.findByRole("button", { name: /저장한 문제/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /저장한 문장/ })).not.toBeInTheDocument();
  });
});
