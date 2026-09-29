import { describe, expect, it, vi, beforeEach } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Quiz } from "../lib/types";

vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { user_id: "u1", app_language: "ko" } }) }));

const { savedSentences, bookmarks, quizMarkViewed, recordActivity } = vi.hoisted(() => ({
  savedSentences: vi.fn(),
  bookmarks: vi.fn(),
  quizMarkViewed: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { recordActivity },
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
import { useSavedReturn } from "../lib/savedReturn";

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

// Stands in for the single-item review screen, using the REAL return path its
// back chevron and reward modal both call.
function ReviewStub() {
  const back = useSavedReturn("problem");
  const state = useLocation().state;
  return (
    <>
      <div data-testid="review-state">{JSON.stringify(state)}</div>
      <button onClick={back}>back-to-saved</button>
    </>
  );
}

// Renders a realistic history [origin, /saved] and mounts under StrictMode so the
// dev mount→unmount→mount double-invoke is exercised — the exact condition that
// broke the earlier consume-once restore.
/** `first` seeds the Practice Settings priority the way the app does — Saved
 *  reads the track order straight off the cached ["dashboard"] summary. */
function renderRoundTrip(
  savedEntry: string | { pathname: string; state?: unknown },
  first: "conversation" | "topik" = "conversation",
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const order = first === "topik" ? ["topik", "conversation"] : ["conversation", "topik"];
  qc.setQueryData(["dashboard"], {
    tracks: order.map((category, i) => ({
      track_id: `t_${category}`,
      category,
      display_order: i + 1,
      name: category,
      level: 1,
      level_label: "Lv.1",
      next_lesson_id: null,
      goal: { key: "daily", label: "", target: 5, current: 0, achieved: false },
    })),
  });
  const router = createMemoryRouter(
    [
      { path: "/saved", element: <Saved /> },
      { path: "/review/question/:quizId", element: <ReviewStub /> },
    ],
    { initialEntries: ["/home", savedEntry], initialIndex: 1 },
  );
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <StrictMode>
          <RouterProvider router={router} />
        </StrictMode>
      </QueryClientProvider>
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

describe("Saved — the list itself is not studying", () => {
  it("records no study activity for the saved list (only the review screens it opens do)", async () => {
    renderRoundTrip("/saved", "topik");
    expect(await screen.findByText(/알맞은 것을 고르십시오/)).toBeInTheDocument();
    expect(recordActivity).not.toHaveBeenCalled();
  });
});

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

  it("hands the review the category and feed it was opened from", async () => {
    renderRoundTrip("/saved");
    await switchToQuestionsAndOpenReview();
    const state = JSON.parse(screen.getByTestId("review-state").textContent || "null");
    expect(state).toMatchObject({ tab: "problem", source: "wrong" });
    expect(typeof state.savedKey).toBe("string");
  });
});

describe("Saved — first tab follows the Practice Settings priority", () => {
  it("opens on Sentences when Conversation is first", async () => {
    renderRoundTrip("/saved", "conversation");
    expect(await screen.findByRole("button", { name: /저장한 문장/ })).toBeInTheDocument();
  });

  it("opens on Questions when TOPIK is first", async () => {
    renderRoundTrip("/saved", "topik");
    expect(await screen.findByRole("button", { name: /저장한 문제/ })).toBeInTheDocument();
  });

  it("an explicit nav tab still wins over the priority", async () => {
    // Kept so a caller that really does mean one tab can still say so.
    renderRoundTrip({ pathname: "/saved", state: { tab: "sentence" } }, "topik");
    expect(await screen.findByRole("button", { name: /저장한 문장/ })).toBeInTheDocument();
  });
});
