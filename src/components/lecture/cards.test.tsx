import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { attempt, speechAttempt, recorder } = vi.hoisted(() => ({
  attempt: vi.fn(),
  speechAttempt: vi.fn(),
  recorder: {
    start: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
    recording: false,
    options: null as null | { onRecorded: (b: Blob) => Promise<void> | void; onUnavailable: () => void },
  },
}));
vi.mock("../../api/endpoints", () => ({
  quizApi: { attempt, bookmark: vi.fn(), unbookmark: vi.fn(), audio: vi.fn() },
  sentenceApi: { speechAttempt, audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
}));
vi.mock("../../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../../hooks/useVoiceRecorder", () => ({
  useVoiceRecorder: (options: typeof recorder.options) => {
    recorder.options = options;
    return recorder;
  },
}));

import { I18nProvider } from "../../i18n";
import { QuestionCard } from "./QuestionCard";
import { SpeakingCard, listenWindowMs } from "./SpeakingCard";
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
    expect(attempt).toHaveBeenCalledWith("q1", { answer: "2", source: "lecture" });
    // COU-013: the rejected pick cannot be resubmitted.
    expect(screen.getByRole("button", { name: "제출" })).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /덕분에/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    fireEvent.click(await screen.findByRole("button", { name: "다음" }));
    expect(screen.getByText("정답이에요!")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledWith(false);
  });
});

describe("SpeakingCard", () => {
  it("listens as soon as it shows and turns blue on a good take", async () => {
    const onOutcome = vi.fn();
    speechAttempt.mockResolvedValue({ correct: true });
    ko(<SpeakingCard sentence={SENTENCE} onOutcome={onOutcome} onMicDeclined={vi.fn()} />);

    expect(screen.getByText("따라해보세요!")).toBeInTheDocument();
    await waitFor(() => expect(recorder.start).toHaveBeenCalled());
    await act(async () => {
      await recorder.options!.onRecorded(new Blob(["x"]));
    });

    expect(speechAttempt).toHaveBeenCalledWith("s1", expect.any(Blob), "attempt.webm", "lecture");
    expect(screen.getByText("완벽해요!")).toBeInTheDocument();
    expect(onOutcome).toHaveBeenLastCalledWith("correct");
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
      await recorder.options!.onRecorded(new Blob(["x"]));
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
});
