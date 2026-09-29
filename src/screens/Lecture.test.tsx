import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { lecture, lecturePlay, progress, recordActivity } = vi.hoisted(() => ({
  lecture: vi.fn(),
  lecturePlay: vi.fn(),
  progress: vi.fn(),
  recordActivity: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  learnApi: { lecture, lecturePlay, progress, recordActivity },
}));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn(), show: vi.fn() }) }));

import { Lecture } from "./Lecture";
import { I18nProvider } from "../i18n";

function detail(playback: { last_position_seconds: number; completed: boolean } | null) {
  return {
    lecture_id: "L1",
    track_id: "track_conversation",
    course_id: null,
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
  };
}

function renderLecture(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const utils = render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/lectures/L1"]}>
          <Routes>
            <Route path="/lectures/:lectureId" element={<Lecture />} />
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
  fireEvent.loadedMetadata(video!);
  return video!;
}

beforeEach(() => {
  vi.clearAllMocks();
  lecturePlay.mockResolvedValue({ video: { url: "http://x/v.mp4", duration_seconds: 300, captions_url: null } });
  progress.mockResolvedValue({ position_seconds: 0, max_watched_seconds: 0, completed: false });
  recordActivity.mockResolvedValue({});
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

  it("finishing the video refreshes the lecture catalog", async () => {
    // Regression: only the dashboard and course were refreshed, so the catalog
    // (["lectures", filter]) kept showing the lecture as not done.
    lecture.mockResolvedValue(detail(null));
    const { container, qc } = renderLecture();
    qc.setQueryData(["lectures", "all"], { items: [] });
    const video = await loadedVideo(container);
    fireEvent.ended(video);
    await waitFor(() => expect(progress).toHaveBeenCalledWith("L1", 300));
    await waitFor(() => expect(qc.getQueryState(["lectures", "all"])?.isInvalidated).toBe(true));
  });
});
