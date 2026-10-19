import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { attempt, speechAttempt, recorder } = vi.hoisted(() => ({
  attempt: vi.fn(),
  speechAttempt: vi.fn(),
  recorder: {
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    recording: false,
    phase: "idle",
    mode: "upload",
    options: null as null | {
      onSpoken: (spoken: { audio?: Blob; take?: { filename: string; durationMs: number }; transcript?: { transcriptIds: string[]; text: string; status: string; latencyMs: number; provider: string } }) => Promise<void> | void;
      onNothingHeard?: () => void;
      onUnavailable: () => void;
    },
  },
}));
vi.mock("../../api/endpoints", () => ({
  quizApi: { attempt, bookmark: vi.fn(), unbookmark: vi.fn(), audio: vi.fn() },
  sentenceApi: { speechAttempt, audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
}));
vi.mock("../../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../../hooks/useSpeechInput", () => ({
  useSpeechInput: (options: typeof recorder.options) => {
    recorder.options = options;
    return recorder;
  },
}));

import { I18nProvider } from "../../i18n";
import { ApiError } from "../../lib/http";
import { QuestionCard } from "./QuestionCard";
import { SpeakingCard, koreanSize, listenWindowMs } from "./SpeakingCard";
import type { Quiz, Sentence } from "../../lib/types";

const QUIZ = {
  quiz_id: "q1",
  prompt: "어제 충분히 휴식을 취한 ( ) 오늘 하루도 힘차게 시작할 수 있었다.",
  answer: { format: "single_choice", choices: [{ key: "1", text: "덕분에" }, { key: "2", text: "동안" }] },
} as unknown as Quiz;

const SENTENCE = {
  sentence_id: "s1",
  korean: "반갑습니다",
  romanization: "bangapseumnida",
  translation: "Nice to meet you.",
  level: 1,
} as Sentence;

const ko = (ui: React.ReactNode) => render(<I18nProvider language="ko">{ui}</I18nProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  recorder.options = null;
});

describe("QuestionCard", () => {
  it("keeps the learner on a wrong answer until they pick another and get it right", async () => {
    const onDone = vi.fn();
    attempt.mockResolvedValueOnce({ attempt_id: "a1", correct: false }).mockResolvedValueOnce({ attempt_id: "a2", correct: true });
    ko(<QuestionCard quiz={QUIZ} source="lecture" onDone={onDone} />);

    fireEvent.click(screen.getByRole("radio", { name: /동안/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    expect(await screen.findByText("다시 풀어보세요")).toBeInTheDocument();
    expect(attempt).toHaveBeenCalledWith("q1", { answer: "2", source: "lecture", client_request_id: expect.any(String) });
    // COU-013: the rejected pick cannot be resubmitted.
    expect(screen.getByRole("button", { name: "제출" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /덕분에/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    expect(screen.getByText("정답이에요!")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(false);
    // Each new answer is its own submission (a fresh idempotency key).
    const keys = attempt.mock.calls.map((c) => (c[1] as { client_request_id: string }).client_request_id);
    expect(new Set(keys).size).toBe(2);
  });

  it("resends a failed submission under the same key, and sends the practice set id", async () => {
    attempt.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ attempt_id: "a1", correct: true });
    ko(<QuestionCard quiz={QUIZ} source="custom" learningSessionId="set-1" onDone={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /덕분에/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    await waitFor(() => expect(attempt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "제출" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    expect(await screen.findByRole("button", { name: "다음" })).toBeInTheDocument();

    const [first, second] = attempt.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(second.client_request_id).toBe(first.client_request_id);
    expect(second.learning_session_id).toBe("set-1");
  });
});

const TAKE = { filename: "attempt.m4a", durationMs: 1800 };

describe("SpeakingCard", () => {
  it("listens as soon as it shows and turns blue on a good take", async () => {
    const onOutcome = vi.fn();
    speechAttempt.mockResolvedValue({ correct: true });
    ko(<SpeakingCard sentence={SENTENCE} onOutcome={onOutcome} onMicDeclined={vi.fn()} />);

    expect(screen.getByText("따라해보세요!")).toBeInTheDocument();
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    await act(async () => {
      await recorder.options!.onSpoken({ audio: new Blob(["x"]), take: TAKE });
    });

    expect(speechAttempt).toHaveBeenCalledWith("s1", expect.any(Blob), TAKE, "lecture");
    expect(screen.getByText("완벽해요!")).toBeInTheDocument();
    expect(onOutcome).toHaveBeenLastCalledWith("correct");
  });

  it("submits a live transcript by id and grades on the server's verdict, not on hearing speech", async () => {
    const onOutcome = vi.fn();
    speechAttempt.mockResolvedValue({ correct: false, feedback_code: "unrelated_speech" });
    ko(<SpeakingCard sentence={SENTENCE} onOutcome={onOutcome} onMicDeclined={vi.fn()} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    const transcript = { transcriptIds: ["trn_1"], text: "감사합니다", status: "ok", latencyMs: 1200, provider: "whisper_local" };
    await act(async () => {
      await recorder.options!.onSpoken({ transcript });
    });

    expect(speechAttempt).toHaveBeenCalledWith("s1", transcript, undefined, "lecture");
    expect(onOutcome).toHaveBeenLastCalledWith("wrong");
    expect(screen.getByText("다시 한 번 말해보세요!")).toBeInTheDocument();
    expect(screen.getByText("다른 말을 한 것 같아요. 위 문장을 읽어 주세요.")).toBeInTheDocument();
  });

  it("treats a failed grading as an error to retry, never as a wrong reading", async () => {
    const onOutcome = vi.fn();
    speechAttempt.mockRejectedValue(new ApiError(503, "speech_recognition_unavailable", "down"));
    ko(<SpeakingCard sentence={SENTENCE} onOutcome={onOutcome} onMicDeclined={vi.fn()} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    await act(async () => {
      await recorder.options!.onSpoken({ audio: new Blob(["x"]), take: TAKE });
    });

    expect(onOutcome).toHaveBeenLastCalledWith("error");
    expect(onOutcome).not.toHaveBeenCalledWith("wrong");
    expect(screen.getByText("채점하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시하기/ }));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledTimes(2));
  });

  it("does not count a silent take as wrong", async () => {
    const onOutcome = vi.fn();
    speechAttempt.mockRejectedValue(new ApiError(422, "speech.no_speech", "Nothing was heard."));
    ko(<SpeakingCard sentence={SENTENCE} onOutcome={onOutcome} onMicDeclined={vi.fn()} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    await act(async () => {
      await recorder.options!.onSpoken({ audio: new Blob(["x"]), take: TAKE });
    });

    expect(onOutcome).not.toHaveBeenCalledWith("wrong");
    expect(screen.queryByText("다시 한 번 말해보세요!")).not.toBeInTheDocument();
  });

  it("asks for the microphone when it cannot be used, and lets the learner decline", async () => {
    const onMicDeclined = vi.fn();
    ko(<SpeakingCard sentence={SENTENCE} onMicDeclined={onMicDeclined} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    act(() => recorder.options!.onUnavailable());

    expect(screen.getByText("마이크 접근을 허용해주세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onMicDeclined).toHaveBeenCalled();
  });

  it("shows 다시 한 번 말해보세요! on a weak take and listens again on 다시하기", async () => {
    speechAttempt.mockResolvedValue({ correct: false });
    ko(<SpeakingCard sentence={SENTENCE} onMicDeclined={vi.fn()} />);
    await waitFor(() => expect(recorder.start).toHaveBeenCalledTimes(1));
    await act(async () => {
      await recorder.options!.onSpoken({ audio: new Blob(["x"]), take: TAKE });
    });
    expect(screen.getByText("다시 한 번 말해보세요!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /다시하기/ }));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledTimes(2));
  });

  it("listens long enough for the sentence, within bounds", () => {
    expect(listenWindowMs("반갑습니다")).toBe(3250);
    expect(listenWindowMs("네")).toBe(2500);
    expect(listenWindowMs("가".repeat(40))).toBe(8000);
  });

  it("sets a short phrase at the designed size and steps longer sentences down", () => {
    expect(koreanSize("안녕하세요")).toBe("lg");
    // Spaces do not count: it is the syllables that fill a line.
    expect(koreanSize("주말에 친구들과 공원에 갔어요")).toBe("md");
    expect(koreanSize("주말에 친구들과 함께 한강 공원에 가서 자전거를 타고 치킨을 먹었어요")).toBe("sm");
    expect(koreanSize("가".repeat(41))).toBe("xs");
  });
});
