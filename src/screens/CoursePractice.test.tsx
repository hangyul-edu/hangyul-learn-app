/**
 * COU-002 / COU-014..021: the course page's practice entry points and reward,
 * the repeat-after-me practice, and the TOPIK practice run.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({
  course: vi.fn(),
  lecture: vi.fn(),
  speakPractice: vi.fn(),
  recordActivity: vi.fn(),
  getSentence: vi.fn(),
  speechAttempt: vi.fn(),
  start: vi.fn(),
  attempt: vi.fn(),
  recorder: { options: null as null | { onRecorded: (b: Blob) => Promise<void> | void } },
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { course: api.course, lecture: api.lecture, speakPractice: api.speakPractice, recordActivity: api.recordActivity },
  sentenceApi: { get: api.getSentence, speechAttempt: api.speechAttempt, audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
  practiceApi: { start: api.start },
  quizApi: { attempt: api.attempt, bookmark: vi.fn(), unbookmark: vi.fn(), audio: vi.fn() },
  aiApi: {},
  studyApi: {},
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));
vi.mock("../hooks/useVoiceRecorder", () => ({
  useVoiceRecorder: (options: typeof api.recorder.options) => {
    api.recorder.options = options;
    return { recording: false, start: () => Promise.resolve(), stop: vi.fn() };
  },
}));

import { I18nProvider } from "../i18n";
import { CourseDetail } from "./Courses";
import { SpeakPractice } from "./SpeakPractice";
import { Practice } from "./Practice";

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderAt(path: string, state?: unknown) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[{ pathname: path, state }]}>
          <Routes>
            <Route path="/courses/:courseId" element={<CourseDetail />} />
            <Route path="/lectures/:lectureId/speak" element={<SpeakPractice />} />
            <Route path="/lectures/:lectureId/practice" element={<Practice />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const lesson = (id: string, track: string, extra = {}) => ({
  lecture_id: id,
  track_id: track,
  course_id: "C1",
  title: `강의 ${id}`,
  kind: "video",
  duration_seconds: 210,
  thumbnail_url: null,
  topik_question_type: null,
  completed: false,
  started: false,
  access: "free",
  ...extra,
});

const sentence = (id: string, korean: string) => ({ sentence_id: id, korean, translation: `${korean} (en)`, level: 1 });

const QUIZ = (id: string) => ({
  quiz_id: id,
  prompt: `문제 ${id}`,
  answer: { format: "single_choice", choices: [{ key: "1", text: "덕분에" }, { key: "2", text: "동안" }] },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.recordActivity.mockResolvedValue({});
  api.lecture.mockResolvedValue(lesson("L1", "track_conversation"));
});

describe("CourseDetail", () => {
  it("sends the mic to speaking practice and the TOPIK notebook to question practice", async () => {
    api.course.mockResolvedValue({
      course_id: "C1",
      track_id: "track_conversation",
      title: "코스",
      lessons: [lesson("L1", "track_conversation"), lesson("T1", "track_topik")],
    });
    api.speakPractice.mockResolvedValue({ lecture_id: "L1", items: [] });
    const first = renderAt("/courses/C1");
    fireEvent.click(await screen.findByRole("button", { name: "강의 T1 문제 연습" }));
    expect(await screen.findByText("몇 문제 풀어볼까요?")).toBeInTheDocument();
    first.unmount();

    renderAt("/courses/C1");
    fireEvent.click(await screen.findByRole("button", { name: "강의 L1 말하기 연습" }));
    expect(await screen.findByText("이 강의에는 따라 말하기 연습이 없어요")).toBeInTheDocument();
  });

  it("resumes the lesson the learner is part-way through", async () => {
    api.course.mockResolvedValue({
      course_id: "C1",
      track_id: "track_conversation",
      title: "코스",
      lessons: [lesson("L1", "track_conversation"), lesson("L2", "track_conversation", { started: true })],
    });
    renderAt("/courses/C1");
    fireEvent.click(await screen.findByRole("button", { name: "바로 학습하기" }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/lectures/L2");
  });

  it("shows the watch-complete reward the player handed back (COU-021)", async () => {
    api.course.mockResolvedValue({ course_id: "C1", track_id: "track_conversation", title: "코스", lessons: [] });
    renderAt("/courses/C1", { rewardPoints: 100 });
    expect(await screen.findByText("시청 완료!")).toBeInTheDocument();
    expect(screen.getByText("+100P")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(screen.queryByText("시청 완료!")).toBeNull());
  });
});

describe("SpeakPractice", () => {
  beforeEach(() => {
    api.speakPractice.mockResolvedValue({
      lecture_id: "L1",
      items: [
        { checkpoint_id: "c1", at_second: 10, sentence_id: "s1" },
        { checkpoint_id: "c2", at_second: 20, sentence_id: "s2" },
      ],
    });
    api.getSentence.mockImplementation((id: string) =>
      Promise.resolve(id === "s1" ? sentence("s1", "반갑습니다") : sentence("s2", "감사합니다")),
    );
  });

  it("steps through the lecture's sentences and offers 다시 시작 / 완료 on the last", async () => {
    api.speechAttempt.mockResolvedValue({ correct: true });
    renderAt("/lectures/L1/speak");
    expect(await screen.findByText("연습 문장 1/2")).toBeInTheDocument();
    expect(await screen.findByText("반갑습니다")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이전 문장" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "다음 문장" }));
    expect(await screen.findByText("감사합니다")).toBeInTheDocument();
    expect(screen.getByText("연습 문장 2/2")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "완료" })).toBeNull();

    await waitFor(() => expect(api.recorder.options).not.toBeNull());
    await act(async () => {
      await api.recorder.options!.onRecorded(new Blob(["x"]));
    });
    expect(screen.getByText("완벽해요!")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시작" }));
    expect(await screen.findByText("연습 문장 1/2")).toBeInTheDocument();
  });

  it("asks before leaving mid-practice", async () => {
    renderAt("/lectures/L1/speak");
    await screen.findByText("연습 문장 1/2");
    fireEvent.click(screen.getByRole("button", { name: "뒤로 가기" }));
    expect(await screen.findByText("연습을 마칠까요?")).toBeInTheDocument();
  });

  it("says so when the lecture has no speaking checkpoints", async () => {
    api.speakPractice.mockResolvedValue({ lecture_id: "L1", items: [] });
    renderAt("/lectures/L1/speak");
    expect(await screen.findByText("이 강의에는 따라 말하기 연습이 없어요")).toBeInTheDocument();
  });
});

describe("Practice", () => {
  it("offers the explanation after a wrong answer and the bottom bar after the last", async () => {
    api.start.mockResolvedValue({ practice_set_id: "p1", items: [QUIZ("q1")], count: 1 });
    api.attempt
      .mockResolvedValueOnce({ attempt_id: "a1", correct: false })
      .mockResolvedValueOnce({ attempt_id: "a2", correct: true });
    renderAt("/lectures/L1/practice");
    fireEvent.click(await screen.findByRole("button", { name: "시작할게요!" }));

    fireEvent.click(await screen.findByRole("radio", { name: /동안/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    expect(await screen.findByRole("button", { name: "헷갈린 부분 내가 알려줄게!" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /덕분에/ }));
    fireEvent.click(screen.getByRole("button", { name: "제출" }));
    expect(await screen.findByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "완료" })).toBeInTheDocument();
  });
});
