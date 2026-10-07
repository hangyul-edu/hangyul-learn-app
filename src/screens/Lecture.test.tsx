import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

const { lecture, lecturePlay, lectureVideo, progress, completeLecture, checkpointInteraction, recordActivity, summary, series } = vi.hoisted(() => ({
  series: vi.fn(),
  lecture: vi.fn(),
  lecturePlay: vi.fn(),
  lectureVideo: vi.fn(),
  progress: vi.fn(),
  completeLecture: vi.fn(),
  checkpointInteraction: vi.fn(),
  recordActivity: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { lecture, lecturePlay, lectureVideo, progress, completeLecture, checkpointInteraction, recordActivity, series },
  dashboardApi: { summary },
  aiApi: {},
  quizApi: { attempt: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
  sentenceApi: { speechAttempt: vi.fn(), audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { Lecture, peekSeriesReward } from "./Lecture";
import { SeriesPage } from "./Courses";
import { I18nProvider } from "../i18n";

const QUESTION = {
  quiz_id: "q1",
  prompt: "알맞은 것을 고르십시오.",
  answer: { format: "single_choice", choices: [{ key: "1", text: "덕분에" }, { key: "2", text: "동안" }] },
};

function detail(
  playback: { last_position_seconds: number; completed: boolean } | null,
  extra: Record<string, unknown> = {},
) {
  return {
    lecture_id: "L1",
    track_id: "track_conversation",
    course_id: "C1",
    series_id: "S1",
    title: "Lecture L1",
    kind: "video",
    duration_seconds: 300,
    thumbnail_url: null,
    topik_question_type: null,
    completed: false,
    started: !!playback,
    access: "free",
    checkpoints: [],
    my_playback: playback && { ...playback, max_watched_seconds: playback.last_position_seconds },
    ...extra,
  };
}

function CourseProbe() {
  const location = useLocation();
  return <div data-testid="course">{JSON.stringify(location.state)}</div>;
}

function renderLecture(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const utils = render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/lectures/L1"]}>
          <Routes>
            <Route path="/lectures/:lectureId" element={<Lecture />} />
            <Route path="/series/:seriesId" element={<CourseProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { ...utils, qc };
}

async function loadedVideo(container: HTMLElement): Promise<HTMLVideoElement> {
  let video: HTMLVideoElement | null = null;
  await waitFor(() => {
    video = container.querySelector("video");
    expect(video).not.toBeNull();
  });
  Object.defineProperty(video!, "duration", { configurable: true, value: 300 });
  video!.pause = vi.fn();
  video!.play = vi.fn(() => Promise.resolve());
  fireEvent.loadedMetadata(video!);
  return video!;
}

/** Simulate continuous playback reaching `seconds`. */
function playTo(video: HTMLVideoElement, seconds: number) {
  act(() => {
    video.currentTime = seconds;
    fireEvent.timeUpdate(video);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  lecturePlay.mockResolvedValue({ video: { url: "http://x/v.mp4", duration_seconds: 300, captions_url: null } });
  lectureVideo.mockResolvedValue({ lecture_id: "L1", video_url: "http://x/v.mp4", expires_at: "2026-10-06T12:00:00Z" });
  progress.mockResolvedValue({ position_seconds: 0, max_watched_seconds: 0, completed: false });
  completeLecture.mockResolvedValue({ lecture_id: "L1", completed: true, already_completed: false, xp_earned: 15, points_earned: 100 });
  recordActivity.mockResolvedValue({});
  summary.mockResolvedValue({ tracks: [{ track_id: "track_conversation", goal: { achieved: false } }] });
});

describe("Lecture player", () => {
  it("resumes playback at the saved position", async () => {
    // Regression: the scrubber showed the saved position but the video itself
    // started from 0:00, so play jumped the learner back to the beginning.
    lecture.mockResolvedValue(detail({ last_position_seconds: 120, completed: false }));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.currentTime).toBe(120);
  });

  it("starts a finished lecture from the beginning", async () => {
    lecture.mockResolvedValue(detail({ last_position_seconds: 300, completed: true }));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.currentTime).toBe(0);
  });

  it("resumes a completed lecture the learner is re-watching", async () => {
    // Regression: completed is permanent, so once a lesson was finished every
    // later visit started from 0:00 wherever the learner had left it.
    lecture.mockResolvedValue(detail({ last_position_seconds: 120, completed: true }));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.currentTime).toBe(120);
  });

  it("starts over when the video was left in its last seconds", async () => {
    lecture.mockResolvedValue(detail({ last_position_seconds: 298, completed: false }));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.currentTime).toBe(0);
  });

  it("reports progress while playing, so the server counts the lecture as watched", async () => {
    // Regression: progress was only sent on a scrub and at the very end, and
    // the server only advances the watched frontier in steps of ≤60s, so no
    // lecture could ever be completed.
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    for (let s = 1; s <= 31; s += 1) playTo(video, s);
    await waitFor(() => expect(progress).toHaveBeenCalledWith("L1", 15));
    expect(progress).toHaveBeenCalledWith("L1", 30);
  });

  it("completes the lecture at the end and takes the reward back to the course", async () => {
    // Regression: the player never called POST /complete, so a lecture was
    // never marked done and its +100P never paid.
    lecture.mockResolvedValue(detail(null));
    const { container, qc } = renderLecture();
    qc.setQueryData(["lectures", "all"], { items: [] });
    const video = await loadedVideo(container);
    fireEvent.ended(video);
    await waitFor(() => expect(completeLecture).toHaveBeenCalledWith("L1"));
    expect(progress).toHaveBeenCalledWith("L1", 300);
    expect(qc.getQueryState(["lectures", "all"])?.isInvalidated).toBe(true);

    // COU-009, then 계속하기 → the course page with the points for COU-021.
    expect(await screen.findByText("끝까지 다 봤어요 👏")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(await screen.findByTestId("course")).toHaveTextContent('{"rewardPoints":100}');
  });

  it("reports the lesson's full length at the end even when the video's own length is a fraction short", async () => {
    // A 299.6 s video stored as 300 s: the floored element duration would
    // leave the server one second short of "watched in full".
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    Object.defineProperty(video, "duration", { configurable: true, value: 299.6 });
    fireEvent.ended(video);
    await waitFor(() => expect(completeLecture).toHaveBeenCalledWith("L1"));
    expect(progress).toHaveBeenCalledWith("L1", 300);
  });

  it("reports the end once even if the video says it ended twice", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    fireEvent.ended(video);
    fireEvent.ended(video);
    expect(await screen.findByText("끝까지 다 봤어요 👏")).toBeInTheDocument();
    expect(completeLecture).toHaveBeenCalledTimes(1);
  });

  it("exiting with ✕ after finishing still carries the reward to the series page", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    fireEvent.ended(video);
    await screen.findByText("끝까지 다 봤어요 👏");
    fireEvent.click(screen.getByRole("button", { name: "닫기", hidden: true }));
    expect(await screen.findByTestId("course")).toHaveTextContent('{"rewardPoints":100}');
  });

  it("pauses at a checkpoint and opens its question, then resumes after 다음", async () => {
    lecture.mockResolvedValue(
      detail(null, { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "multiple_choice", at_second: 10 }] }),
    );
    checkpointInteraction.mockResolvedValue({
      checkpoint_id: "cp1",
      lecture_id: "L1",
      interaction_type: "multiple_choice",
      at_second: 10,
      sentence: null,
      question: QUESTION,
    });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    playTo(video, 9.8);
    playTo(video, 10.1);

    expect(video.pause).toHaveBeenCalled();
    expect(await screen.findByText("알맞은 것을 고르십시오.")).toBeInTheDocument();
    expect(checkpointInteraction).toHaveBeenCalledWith("L1", "cp1");
  });

  it("reopens on the checkpoint card the learner left on, without playing up to it first", async () => {
    // Regression: leaving on the card at 10.4s saved 10 (whole seconds), so
    // reopening played 0.4s of video and then stopped for the same card.
    lecture.mockResolvedValue(
      detail(
        { last_position_seconds: 10, completed: false },
        { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "multiple_choice", at_second: 10.4 }] },
      ),
    );
    checkpointInteraction.mockResolvedValue({
      checkpoint_id: "cp1",
      lecture_id: "L1",
      interaction_type: "multiple_choice",
      at_second: 10.4,
      sentence: null,
      question: QUESTION,
    });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.play).not.toHaveBeenCalled();
    expect(video.currentTime).toBe(10.4);
    expect(await screen.findByText("알맞은 것을 고르십시오.")).toBeInTheDocument();
    // Playing on from the card does not stop for the same checkpoint again.
    playTo(video, 10.6);
    expect(video.pause).not.toHaveBeenCalled();
  });

  it("resumes normally when the next checkpoint is further on", async () => {
    lecture.mockResolvedValue(
      detail(
        { last_position_seconds: 10, completed: false },
        { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "multiple_choice", at_second: 12 }] },
      ),
    );
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    expect(video.currentTime).toBe(10);
    expect(video.play).toHaveBeenCalled();
    expect(checkpointInteraction).not.toHaveBeenCalled();
  });

  it("skips speaking checkpoints when 말하기 제외 is on", async () => {
    lecture.mockResolvedValue(
      detail(null, { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "speaking_exercise", at_second: 10 }] }),
    );
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    fireEvent.click(screen.getByRole("checkbox", { name: /말하기 제외/ }));
    playTo(video, 9.8);
    playTo(video, 10.1);

    expect(checkpointInteraction).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
  });

  it("shows a skipped checkpoint again once 말하기 제외 is off and the learner rewinds", async () => {
    lecture.mockResolvedValue(
      detail(null, { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "speaking_exercise", at_second: 10 }] }),
    );
    checkpointInteraction.mockResolvedValue({
      checkpoint_id: "cp1",
      lecture_id: "L1",
      interaction_type: "multiple_choice",
      at_second: 10,
      sentence: null,
      question: QUESTION,
    });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    const toggle = screen.getByRole("checkbox", { name: /말하기 제외/ });
    fireEvent.click(toggle);
    playTo(video, 9.8);
    playTo(video, 10.1);
    expect(checkpointInteraction).not.toHaveBeenCalled();

    fireEvent.click(toggle);
    playTo(video, 4); // rewind
    playTo(video, 9.8);
    playTo(video, 10.1);
    expect(video.pause).toHaveBeenCalled();
    expect(await screen.findByText("알맞은 것을 고르십시오.")).toBeInTheDocument();
  });

  it("shows a checkpoint again when the learner rewinds over one already answered", async () => {
    lecture.mockResolvedValue(
      detail(null, { checkpoints: [{ checkpoint_id: "cp1", interaction_type: "multiple_choice", at_second: 10 }] }),
    );
    checkpointInteraction.mockResolvedValue({
      checkpoint_id: "cp1",
      lecture_id: "L1",
      interaction_type: "multiple_choice",
      at_second: 10,
      sentence: null,
      question: QUESTION,
    });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    playTo(video, 9.8);
    playTo(video, 10.1);
    expect(await screen.findByText("알맞은 것을 고르십시오.")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" }); // close the modal
    await waitFor(() => expect(screen.queryByText("알맞은 것을 고르십시오.")).toBeNull());

    playTo(video, 3); // rewind
    playTo(video, 9.8);
    playTo(video, 10.1);
    expect(await screen.findByText("알맞은 것을 고르십시오.")).toBeInTheDocument();
  });

  it("does not report progress for every frame of a backward scrub", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    for (let s = 1; s <= 20; s += 1) playTo(video, s); // one beat at 15
    progress.mockClear();
    for (let s = 19; s >= 2; s -= 1) playTo(video, s); // dragging back
    expect(progress).not.toHaveBeenCalled();
  });

  it("shows pause while the video plays, and pausing from it stops the video", async () => {
    // Regression: the button always showed the play triangle.
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    const button = screen.getByRole("button", { name: "재생" });
    expect(container.querySelector(".lecp__pause")).toBeNull();

    fireEvent.click(button);
    expect(video.play).toHaveBeenCalled();
    fireEvent.play(video); // the browser confirms playback started
    expect(screen.getByRole("button", { name: "일시정지" })).toBe(button);
    expect(container.querySelector(".lecp__pause")).not.toBeNull();

    Object.defineProperty(video, "paused", { configurable: true, value: false });
    fireEvent.click(button);
    expect(video.pause).toHaveBeenCalled();
    fireEvent.pause(video);
    expect(screen.getByRole("button", { name: "재생" })).toBe(button);
    expect(container.querySelector(".lecp__pause")).toBeNull();
  });

  it("opens playing, with the controls hidden until the picture is tapped", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    const player = container.querySelector(".lecp") as HTMLElement;
    expect(video.play).toHaveBeenCalled(); // autoplay
    fireEvent.play(video);
    expect(player.dataset.controls).toBe("hidden");

    vi.useFakeTimers();
    try {
      // A tap on the picture brings them up; they fade again while it plays.
      fireEvent.click(container.querySelector(".lecp__stage")!);
      expect(player.dataset.controls).toBe("shown");
      act(() => vi.advanceTimersByTime(3000));
      expect(player.dataset.controls).toBe("hidden");

      // A tap on the dimmed picture behind them hides them at once.
      fireEvent.click(container.querySelector(".lecp__stage")!);
      fireEvent.click(container.querySelector(".lecp__scrim")!);
      expect(player.dataset.controls).toBe("hidden");

      // Pausing (e.g. for a checkpoint) does not bring them up by itself.
      fireEvent.pause(video);
      act(() => vi.advanceTimersByTime(10_000));
      expect(player.dataset.controls).toBe("hidden");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the ask prompt once, on the first reveal of the controls, and never again", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    fireEvent.play(video);
    const stage = container.querySelector(".lecp__stage")!;
    const promptText = "궁금한 건 나한테 물어봐!";
    expect(screen.queryByText(promptText)).toBeNull(); // controls hidden

    fireEvent.click(stage); // first reveal
    const prompt = screen.getByText(promptText);
    fireEvent.animationEnd(prompt); // it fades itself out
    expect(screen.queryByText(promptText)).toBeNull();

    fireEvent.click(stage); // hide
    fireEvent.click(stage); // reveal again
    expect(container.querySelector(".lecp__ask")).not.toBeNull();
    expect(screen.queryByText(promptText)).toBeNull();
  });

  it("drops the prompt with the controls if they hide before it fades", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    fireEvent.play(video);
    const stage = container.querySelector(".lecp__stage")!;
    fireEvent.click(stage);
    expect(screen.getByText("궁금한 건 나한테 물어봐!")).toBeInTheDocument();
    fireEvent.click(container.querySelector(".lecp__scrim")!); // hide
    fireEvent.click(stage); // reveal again
    expect(screen.queryByText("궁금한 건 나한테 물어봐!")).toBeNull();
  });

  it("shows the controls when the browser refuses to autoplay", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    let video: HTMLVideoElement | null = null;
    await waitFor(() => {
      video = container.querySelector("video");
      expect(video).not.toBeNull();
    });
    Object.defineProperty(video!, "duration", { configurable: true, value: 300 });
    video!.pause = vi.fn();
    video!.play = vi.fn(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    fireEvent.loadedMetadata(video!);
    await waitFor(() =>
      expect((container.querySelector(".lecp") as HTMLElement).dataset.controls).toBe("shown"),
    );
    expect(screen.getByRole("button", { name: "재생" })).toBeInTheDocument();
  });

  it("shows the controls when the video cannot load", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderLecture();
    let video: HTMLVideoElement | null = null;
    await waitFor(() => {
      video = container.querySelector("video");
      expect(video).not.toBeNull();
    });
    expect((container.querySelector(".lecp") as HTMLElement).dataset.controls).toBe("hidden");
    fireEvent.error(video!);
    expect((container.querySelector(".lecp") as HTMLElement).dataset.controls).toBe("shown");
  });

  it("swaps in a fresh URL when the stream stops, and carries on from the same second", async () => {
    // The signed URL runs out mid-watch: the player asks for a new one and
    // picks up where the learner was, instead of a dead video.
    lecture.mockResolvedValue(detail({ last_position_seconds: 5, completed: false }));
    lectureVideo.mockResolvedValue({ lecture_id: "L1", video_url: "http://x/fresh.mp4", expires_at: "2026-10-06T12:00:00Z" });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    playTo(video, 42);
    fireEvent.error(video);
    await waitFor(() => expect(video.getAttribute("src")).toBe("http://x/fresh.mp4"));
    expect(lectureVideo).toHaveBeenCalledWith("L1");
    video.currentTime = 0; // a new source starts at the top
    fireEvent.loadedMetadata(video);
    expect(video.currentTime).toBe(42);
  });

  it("stops asking for fresh URLs when the stream keeps failing", async () => {
    lecture.mockResolvedValue(detail(null));
    lectureVideo.mockResolvedValue({ lecture_id: "L1", video_url: "http://x/v.mp4", expires_at: "2026-10-06T12:00:00Z" });
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    for (let i = 0; i < 6; i++) fireEvent.error(video);
    await waitFor(() => expect(lectureVideo).toHaveBeenCalledTimes(3));
  });

  it("keeps the controls up while there is no video to watch, so close is reachable", async () => {
    lecture.mockResolvedValue(detail(null));
    lecturePlay.mockRejectedValue(new Error("offline"));
    const { container } = renderLecture();
    await screen.findByRole("button", { name: "닫기" });
    expect((container.querySelector(".lecp") as HTMLElement).dataset.controls).toBe("shown");
  });

  it("never shows the lesson's thumbnail: the stage is black until the video's own picture", async () => {
    // Regression: the thumbnail filled the screen before the video started.
    lecture.mockResolvedValue(detail(null, { thumbnail_url: "http://x/thumb.png" }));
    let startPlay: (v: unknown) => void = () => {};
    lecturePlay.mockReturnValue(new Promise((r) => (startPlay = r)));
    const { container } = renderLecture();
    await waitFor(() => expect(container.querySelector(".lecp__blank")).toBeInTheDocument());
    expect(container.querySelector('img[src="http://x/thumb.png"]')).not.toBeInTheDocument();
    await act(async () => startPlay({ video: { url: "http://x/v.mp4", duration_seconds: 300, captions_url: null } }));
    const video = await loadedVideo(container);
    expect(video).not.toHaveAttribute("poster");
    expect(container.querySelector('img[src="http://x/thumb.png"]')).not.toBeInTheDocument();
  });

  it("keeps the controls up while one of the player's dialogs is open", async () => {
    lecture.mockResolvedValue(detail({ last_position_seconds: 5, completed: false }));
    const { container } = renderLecture();
    const video = await loadedVideo(container);
    const player = container.querySelector(".lecp") as HTMLElement;
    vi.useFakeTimers();
    try {
      fireEvent.play(video);
      fireEvent.click(container.querySelector(".lecp__stage")!); // show them
      fireEvent.click(screen.getByRole("button", { name: "닫기" })); // opens the quit confirm
      act(() => vi.advanceTimersByTime(10_000));
      expect(player.dataset.controls).toBe("shown");
    } finally {
      vi.useRealTimers();
    }
  });

  it("labels the playback speed with a lowercase x", async () => {
    lecture.mockResolvedValue(detail(null));
    renderLecture();
    const chip = await screen.findByRole("button", { name: "재생 속도 1배" });
    expect(chip).toHaveTextContent("1x");
    fireEvent.click(chip);
    expect(chip).toHaveTextContent("1.25x");
  });

  it("labels the switch 문제 풀이 제외 on a TOPIK lecture", async () => {
    lecture.mockResolvedValue(detail(null, { track_id: "track_topik" }));
    renderLecture();
    expect(await screen.findByText("문제 풀이 제외")).toBeInTheDocument();
  });

  it("asks before leaving a lecture that is not finished", async () => {
    lecture.mockResolvedValue(detail({ last_position_seconds: 120, completed: false }));
    const { container } = renderLecture();
    await loadedVideo(container);
    // COU-004 closes the player with an X, not a back arrow.
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(await screen.findByText("끝까지 해내면 오늘이 더 뿌듯해질 거예요 😊")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "지금 그만할래요" }));
    expect(await screen.findByTestId("course")).toBeInTheDocument();
  });
});

describe("Lecture player — history and saved position", () => {
  /** Classes tab → series → lesson (opened from the series), as in the app. */
  function renderFromSeries(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    function SeriesProbe() {
      const nav = useNavigate();
      return (
        <div>
          <div data-testid="series">{peekSeriesReward("S1")}</div>
          <button onClick={() => nav(-1)}>series-back</button>
        </div>
      );
    }
    const utils = render(
      <I18nProvider language="ko">
        <QueryClientProvider client={qc}>
          <MemoryRouter
            initialEntries={["/courses", "/series/S1", { pathname: "/lectures/L1", state: { fromSeriesId: "S1" } }]}
            initialIndex={2}
          >
            <Routes>
              <Route path="/courses" element={<div data-testid="classes" />} />
              <Route path="/series/:seriesId" element={<SeriesProbe />} />
              <Route path="/lectures/:lectureId" element={<Lecture />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );
    return { ...utils, qc };
  }

  beforeEach(() => sessionStorage.clear());

  it("steps back to the series it was opened from, so one more back reaches the Classes tab", async () => {
    // Regression: closing replaced the player with a new series entry, leaving
    // the original one behind it — each lesson watched added a back press.
    lecture.mockResolvedValue(detail({ last_position_seconds: 120, completed: false }));
    const { container } = renderFromSeries();
    await loadedVideo(container);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(await screen.findByRole("button", { name: "지금 그만할래요" }));
    await screen.findByTestId("series");
    fireEvent.click(screen.getByRole("button", { name: "series-back" }));
    expect(await screen.findByTestId("classes")).toBeInTheDocument();
  });

  it("hands the reward to the series page it steps back to", async () => {
    lecture.mockResolvedValue(detail(null));
    const { container } = renderFromSeries();
    const video = await loadedVideo(container);
    fireEvent.ended(video);
    await screen.findByText("끝까지 다 봤어요 👏");
    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));
    expect(await screen.findByTestId("series")).toHaveTextContent("100");
  });

  it("saves the position when the player closes, even inside the first 15 seconds", async () => {
    // Regression: only the 15-second beat and pauses saved, so leaving early
    // (or by the system back, which never pauses) kept nothing.
    lecture.mockResolvedValue(detail({ last_position_seconds: 0, completed: false }));
    const { container, unmount } = renderLecture();
    const video = await loadedVideo(container);
    playTo(video, 7.4);
    expect(progress).not.toHaveBeenCalled();
    unmount();
    expect(progress).toHaveBeenCalledWith("L1", 7);
  });

  it("reopens at the position read fresh from the server, not the cached one", async () => {
    // Regression: the app-wide 15s cache handed a reopened lecture the
    // position from its previous visit, so it started from the beginning.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15_000 } } });
    qc.setQueryData(["lecture", "L1", "ko"], detail({ last_position_seconds: 0, completed: false }));
    lecture.mockResolvedValue(detail({ last_position_seconds: 95, completed: false }));
    const { container } = renderLecture(qc);
    const video = await loadedVideo(container);
    expect(lecture).toHaveBeenCalledTimes(1);
    expect(video.currentTime).toBe(95);
  });
});

describe("바로 학습하기 after watching a lesson", () => {
  it("opens the lesson just watched, at its saved position, even while that save is still landing", async () => {
    // Regression: the player saves the position as it closes, and the series
    // page read its list before that save landed (any real network), so
    // 바로 학습하기 kept opening the lesson watched before.
    let saved = false;
    let landSave: () => void = () => {};
    progress.mockImplementation(
      () =>
        new Promise((resolve) => {
          landSave = () => {
            saved = true;
            resolve({ position_seconds: 7, max_watched_seconds: 7, completed: false });
          };
        }),
    );
    const lesson = (id: string) => ({ ...detail(null), lecture_id: id, title: `Lecture ${id}`, started: true });
    // The server's answer: L1 was the last one watched until L2's save lands.
    series.mockImplementation(() =>
      Promise.resolve({
        series_id: "S1",
        course_id: "C1",
        course_title: "Course",
        track_id: "track_conversation",
        title: "Series",
        description: "",
        thumbnail_url: null,
        lesson_count: 2,
        completed_lesson_count: 0,
        started: true,
        has_free_lesson: true,
        lessons: [lesson("L1"), lesson("L2")],
        resume: saved ? { lecture_id: "L2", position_seconds: 7 } : { lecture_id: "L1", position_seconds: 40 },
      }),
    );
    lecture.mockImplementation((id: string) =>
      Promise.resolve({
        ...detail(id === "L2" && saved ? { last_position_seconds: 7, completed: false } : null),
        lecture_id: id,
        title: `Lecture ${id}`,
      }),
    );
    const { container } = render(
      <I18nProvider language="ko">
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/series/S1"]}>
            <Routes>
              <Route path="/series/:seriesId" element={<SeriesPage />} />
              <Route path="/lectures/:lectureId" element={<Lecture />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </I18nProvider>,
    );

    // Watch L2 for a few seconds from its row, then close it.
    fireEvent.click((await screen.findAllByRole("button", { name: "Lecture L2" }))[0]);
    const watching = await loadedVideo(container);
    playTo(watching, 7.4);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    fireEvent.click(await screen.findByRole("button", { name: "지금 그만할래요" }));
    await waitFor(() => expect(progress).toHaveBeenCalledWith("L2", 7));

    // Back on the list while the save is still in flight; then it lands.
    await screen.findByRole("list", { name: "Series" }).catch(() => undefined);
    await act(async () => landSave());

    fireEvent.click(await screen.findByRole("button", { name: "바로 학습하기" }));
    const resumed = await loadedVideo(container);
    await waitFor(() => expect(lecture).toHaveBeenLastCalledWith("L2", "ko"));
    expect(resumed.currentTime).toBe(7);
  });
});
