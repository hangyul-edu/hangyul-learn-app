/**
 * A premium lecture is not opened without premium access: on the series page
 * the tap on the lesson, its practice (mic / notebook) or 바로 학습하기 shows
 * the subscription notice at the bottom (cp_G_03_toast) and stays put; a
 * lecture or practice page reached another way (a direct link) leaves as soon
 * as the server refuses it (402), with the same notice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const api = vi.hoisted(() => ({
  series: vi.fn(),
  lecture: vi.fn(),
  lecturePlay: vi.fn(),
  lectureVideo: vi.fn(),
  speakPractice: vi.fn(),
  start: vi.fn(),
  summary: vi.fn(),
  show: vi.fn(),
  auth: { premium: false },
}));
vi.mock("../api/endpoints", () => ({
  learnApi: {
    series: api.series,
    lecture: api.lecture,
    lecturePlay: api.lecturePlay,
    lectureVideo: api.lectureVideo,
    speakPractice: api.speakPractice,
    progress: vi.fn(),
    completeLecture: vi.fn(),
    checkpointInteraction: vi.fn(),
    recordActivity: vi.fn(() => Promise.resolve({})),
  },
  dashboardApi: { summary: api.summary },
  practiceApi: { start: api.start },
  sentenceApi: { get: vi.fn(), speechAttempt: vi.fn(), audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
  quizApi: { attempt: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn(), audio: vi.fn() },
  aiApi: {},
  studyApi: {},
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: api.show }) }));
vi.mock("../hooks/auth", () => ({
  useAuthOptional: () => ({
    me: { app_language: "ko", membership: { tier: api.auth.premium ? "premium" : "free", is_premium: api.auth.premium, expires_at: null } },
  }),
}));

import { I18nProvider } from "../i18n";
import { SeriesPage } from "./Courses";
import { Lecture } from "./Lecture";
import { SpeakPractice } from "./SpeakPractice";
import { Practice } from "./Practice";
import { ApiError } from "../lib/http";

const NOTICE = "프리미엄 구독이 필요한 강의예요\n프리미엄에서 모든 강의를 볼 수 있어요 ✨";
const PRACTICE_NOTICE = "추가 문제 연습은 프리미엄 전용 기능이에요\n프리미엄에서 강의별 문제를 더 풀어보세요 ✨";
const refused = () => new ApiError(402, "subscription_required", "Premium membership required to open this lecture.");

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderAt(entries: string[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
          <Routes>
            <Route path="/series/:seriesId" element={<SeriesPage />} />
            <Route path="/lectures/:lectureId" element={<Lecture />} />
            <Route path="/lectures/:lectureId/speak" element={<SpeakPractice />} />
            <Route path="/lectures/:lectureId/practice" element={<Practice />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

const lesson = (id: string, track: string, access: "free" | "premium") => ({
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
  access,
});

const series = (resumeId: string | null) => ({
  series_id: "S1",
  course_id: "C1",
  course_title: "Course",
  track_id: "track_conversation",
  title: "SERIES",
  description: "",
  thumbnail_url: null,
  lesson_count: 3,
  completed_lesson_count: 0,
  started: false,
  has_free_lesson: true,
  lessons: [
    lesson("F1", "track_conversation", "free"),
    lesson("P1", "track_conversation", "premium"),
    lesson("PT", "track_topik", "premium"),
    lesson("FT", "track_topik", "free"),
  ],
  resume: resumeId ? { lecture_id: resumeId, position_seconds: 30 } : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.auth.premium = false;
  api.series.mockResolvedValue(series("P1"));
  api.summary.mockResolvedValue({ tracks: [] });
  api.lecture.mockRejectedValue(refused());
  api.speakPractice.mockRejectedValue(refused());
});

describe("series page: the Free chip", () => {
  it("marks the free lessons for a member without premium access", async () => {
    renderAt(["/series/S1"]);
    await screen.findByRole("list", { name: "SERIES" });
    expect(document.querySelectorAll(".cdet__free")).toHaveLength(2);
  });

  it("is hidden for a premium member, to whom every lesson is open", async () => {
    api.auth.premium = true;
    renderAt(["/series/S1"]);
    await screen.findByRole("list", { name: "SERIES" });
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
  });
});

describe("series page: a premium lesson is blocked before it opens", () => {
  it.each([
    ["the lesson", "강의 P1", NOTICE],
    ["its speaking practice", "강의 P1 말하기 연습", NOTICE],
    ["바로 학습하기 onto a premium lesson", "바로 학습하기", NOTICE],
    // The notebook's extra AI practice is premium on every lecture: its own
    // wording, on a free lecture too, so the lecture is never said to be locked.
    ["a premium TOPIK lesson's extra practice", "강의 PT 문제 연습", PRACTICE_NOTICE],
    ["a free TOPIK lesson's extra practice", "강의 FT 문제 연습", PRACTICE_NOTICE],
  ])("%s shows the notice and stays on the series", async (_label, name, notice) => {
    renderAt(["/series/S1"]);
    const target = (await screen.findAllByRole("button", { name }))[0];
    fireEvent.click(target);
    expect(api.show).toHaveBeenCalledWith(notice, "notice");
    expect(api.show).toHaveBeenCalledTimes(1);
    expect(api.start).not.toHaveBeenCalled();
    expect(screen.getByRole("list", { name: "SERIES" })).toBeInTheDocument();
    expect(api.lecture).not.toHaveBeenCalled();
    expect(api.speakPractice).not.toHaveBeenCalled();
  });

  it("a free lesson still opens for a free member", async () => {
    api.lecture.mockReturnValue(new Promise(() => {}));
    renderAt(["/series/S1"]);
    fireEvent.click((await screen.findAllByRole("button", { name: "강의 F1" }))[0]);
    await waitFor(() => expect(api.lecture).toHaveBeenCalledWith("F1", "ko"));
    expect(api.show).not.toHaveBeenCalled();
  });

  it("a free TOPIK lesson itself still opens for a free member", async () => {
    api.lecture.mockReturnValue(new Promise(() => {}));
    renderAt(["/series/S1"]);
    fireEvent.click((await screen.findAllByRole("button", { name: "강의 FT" }))[0]);
    await waitFor(() => expect(api.lecture).toHaveBeenCalledWith("FT", "ko"));
    expect(api.show).not.toHaveBeenCalled();
  });

  it("a premium member opens a TOPIK lesson's extra practice", async () => {
    api.auth.premium = true;
    api.lecture.mockReturnValue(new Promise(() => {}));
    renderAt(["/series/S1"]);
    fireEvent.click(await screen.findByRole("button", { name: "강의 FT 문제 연습" }));
    expect(await screen.findByText("몇 문제 풀어볼까요?")).toBeInTheDocument();
    expect(api.show).not.toHaveBeenCalled();
  });

  it("a premium member opens a premium lesson", async () => {
    api.auth.premium = true;
    api.lecture.mockReturnValue(new Promise(() => {}));
    renderAt(["/series/S1"]);
    fireEvent.click((await screen.findAllByRole("button", { name: "강의 P1" }))[0]);
    await waitFor(() => expect(api.lecture).toHaveBeenCalledWith("P1", "ko"));
    expect(api.show).not.toHaveBeenCalled();
  });
});

describe("a direct link the server refuses leaves with the same notice", () => {
  it.each([
    ["the lecture page", "/lectures/P1", NOTICE],
    ["speaking practice", "/lectures/P1/speak", NOTICE],
    ["a premium lecture's extra practice", "/lectures/PT/practice", PRACTICE_NOTICE],
  ])("%s opened first goes to the lecture tab", async (_label, path, notice) => {
    renderAt([path]);
    expect(await screen.findByTestId("where")).toHaveTextContent("/courses");
    expect(api.show).toHaveBeenCalledWith(notice, "notice");
    expect(api.show).toHaveBeenCalledTimes(1);
    expect(api.lecturePlay).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
  });

  it("a free lecture's extra practice opened by link leaves without the picker", async () => {
    api.lecture.mockResolvedValue({ ...lesson("FT", "track_topik", "free"), checkpoints: [], my_playback: null });
    renderAt(["/series/S1", "/lectures/FT/practice"]);
    expect(await screen.findByRole("list", { name: "SERIES" })).toBeInTheDocument();
    expect(api.show).toHaveBeenCalledWith(PRACTICE_NOTICE, "notice");
    expect(screen.queryByText("몇 문제 풀어볼까요?")).not.toBeInTheDocument();
    expect(api.start).not.toHaveBeenCalled();
  });

  it("a practice set the server refuses (a membership that just lapsed) leaves too", async () => {
    api.auth.premium = true;
    api.lecture.mockResolvedValue({ ...lesson("FT", "track_topik", "free"), checkpoints: [], my_playback: null });
    api.start.mockRejectedValue(refused());
    renderAt(["/series/S1", "/lectures/FT/practice"]);
    fireEvent.click(await screen.findByRole("button", { name: "시작할게요!" }));
    expect(await screen.findByRole("list", { name: "SERIES" })).toBeInTheDocument();
    expect(api.show).toHaveBeenCalledWith(PRACTICE_NOTICE, "notice");
  });

  it("opened from another page, it goes back there", async () => {
    renderAt(["/home", "/lectures/P1"]);
    expect(await screen.findByTestId("where")).toHaveTextContent("/home");
    expect(api.show).toHaveBeenCalledWith(NOTICE, "notice");
  });
});
