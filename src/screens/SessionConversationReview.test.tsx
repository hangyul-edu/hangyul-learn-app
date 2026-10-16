import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";

vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/SessionCompleteModal", () => ({ SessionCompleteModal: () => null }));

const { recSentences, get, blankAttempt, blankHint, speechAttempt, summary, toastShow } = vi.hoisted(() => ({
  recSentences: vi.fn(),
  get: vi.fn(),
  blankAttempt: vi.fn(),
  blankHint: vi.fn(),
  speechAttempt: vi.fn(),
  summary: vi.fn(),
  toastShow: vi.fn(),
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: toastShow }) }));
vi.mock("../hooks/auth", () => ({
  useAuth: () => ({ me: { app_language: "ko" } }),
  useAuthOptional: () => ({ me: { app_language: "ko" } }),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { sentences: recSentences },
  sentenceApi: {
    get,
    blankAttempt,
    blankHint,
    speechAttempt,
    bookmark: vi.fn(),
    unbookmark: vi.fn(),
    markViewed: vi.fn(),
    audio: vi.fn().mockResolvedValue({ url: "http://x/a.mp3" }),
  },
  dashboardApi: { summary },
  learnApi: { recordSession: vi.fn() },
}));

import { SessionConversation } from "./SessionConversation";
import { I18nProvider } from "../i18n";
import { ApiError } from "../lib/http";

const SENTENCE = {
  sentence_id: "sen_thanks_01",
  korean: "덕분에 잘 지내고 있어요.",
  display_text: "덕분에 잘 ___ 있어요.",
  blanks: [{ index: 0, blank_id: "blank-1", display_width_em: 8, revealed_text: "" }],
  translation: "Thanks to you, I'm doing well.",
  translation_language: "en",
  level: 3,
  bookmarked: false,
};

const CORRECT = {
  attempt_id: "blk_1",
  sentence_id: SENTENCE.sentence_id,
  input_mode: "keyboard",
  is_correct: true,
  normalized_answer: "지내고",
  completed_sentence: "덕분에 잘 지내고 있어요.",
  correct_answer: "지내고",
  points_earned: 5,
  submitted_at: "2026-07-25T00:00:00Z",
};

function renderReview() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/review/sentence/:sentenceId", element: <SessionConversation /> },
      { path: "/saved", element: <div>SAVED LIST</div> },
    ],
    { initialEntries: ["/saved", "/review/sentence/sen_thanks_01"], initialIndex: 1 },
  );
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
  summary.mockResolvedValue({
    tracks: [{ category: "conversation", level: 3, goal: { target: 3, current: 0, achieved: false } }],
  });
  get.mockResolvedValue(SENTENCE);
});
afterEach(() => vi.restoreAllMocks());

describe("SessionConversation — saved-sentence review mode", () => {
  it("loads the one saved sentence by id and never requests a new set", async () => {
    renderReview();
    await screen.findByText(/덕분에 잘/);
    expect(get).toHaveBeenCalledWith("sen_thanks_01");
    expect(recSentences).not.toHaveBeenCalled();
  });

  it("submits with source 'review' and shows the completion sheet on correct — no Next", async () => {
    blankAttempt.mockResolvedValue(CORRECT);
    renderReview();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");

    expect(blankAttempt).toHaveBeenCalledWith(
      "sen_thanks_01",
      expect.objectContaining({ source: "review" }),
    );
    // Two-button review sheet; no next / session summary.
    expect(await screen.findByRole("button", { name: "완료" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시작" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "다음" })).not.toBeInTheDocument();
  });

  it("finalizes on 완료: reward modal shows the server points, then returns to the saved list", async () => {
    blankAttempt.mockResolvedValue(CORRECT);
    renderReview();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "지내고{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "완료" }));

    expect(await screen.findByText("복습 완료!")).toBeInTheDocument();
    expect(screen.getByText("+5P")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(await screen.findByText("SAVED LIST")).toBeInTheDocument();
  });

  it("an incorrect answer stays on the item with no completion sheet", async () => {
    blankAttempt.mockResolvedValue({ ...CORRECT, is_correct: false, points_earned: 0 });
    renderReview();
    await screen.findByText(/덕분에 잘/);
    await userEvent.click(screen.getByRole("button", { name: /키보드 모드/ }));
    await userEvent.type(screen.getByLabelText("빈칸에 들어갈 말"), "몰라{Enter}");

    expect(await screen.findByText("다시 생각해보세요")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "완료" })).not.toBeInTheDocument();
  });
});

describe("SessionConversation review — a premium lecture's sentence without premium access", () => {
  it("goes back to the saved list with the subscription notice instead of an error", async () => {
    get.mockRejectedValue(new ApiError(402, "subscription_required", "premium lecture content"));
    renderReview();
    expect(await screen.findByText("SAVED LIST")).toBeInTheDocument();
    expect(toastShow).toHaveBeenCalledWith(
      "프리미엄 구독이 필요한 강의예요\n프리미엄에서 모든 강의를 볼 수 있어요 ✨",
      "notice",
    );
  });
});
