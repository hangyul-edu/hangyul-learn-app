import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { banners, summary, mine, lectures } = vi.hoisted(() => ({
  banners: vi.fn(),
  summary: vi.fn(),
  mine: vi.fn(),
  lectures: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  bannerApi: { list: banners },
  dashboardApi: { summary },
  subApi: { mine },
  learnApi: { lectures },
}));

import { LectureHome } from "./LectureHome";

const banner = (id: string) => ({
  banner_id: id,
  image_url: `http://x/${id}.png`,
  alt_text: `배너 ${id}`,
  action_url: null,
  sort_order: 0,
});
const lecture = (
  id: string,
  track = "track_conversation",
  extra: Record<string, unknown> = {},
) => ({
  lecture_id: id,
  track_id: track,
  course_id: null,
  title: `Lecture ${id}`,
  kind: "video",
  duration_seconds: 300,
  thumbnail_url: null,
  topik_question_type: null,
  completed: false,
  started: false,
  access: "free",
  ...extra,
});
const feed = (items: unknown[]) => ({ items });

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <LectureHome />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summary.mockResolvedValue({ streak_days: 3, studied_today: true });
  mine.mockResolvedValue({ is_premium: false, status: "free" });
  banners.mockResolvedValue({ banners: [banner("b1"), banner("b2")] });
  lectures.mockResolvedValue(
    feed([
      lecture("conv-1"),
      lecture("topik-1", "track_topik"),
    ]),
  );
});

describe("LectureHome unified feed", () => {
  it("shows lectures from BOTH tracks grouped into sections", async () => {
    renderPage();
    expect(await screen.findByText("Lecture conv-1")).toBeInTheDocument();
    expect(screen.getByText("Lecture topik-1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "회화 강의" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "TOPIK 강의" })).toBeInTheDocument();
    // Called without a track filter for the "전체" default.
    expect(lectures).toHaveBeenCalledWith(undefined);
  });

  it("track filter chips re-query with the track query param", async () => {
    renderPage();
    await screen.findByText("Lecture conv-1");
    lectures.mockResolvedValue(feed([lecture("topik-1", "track_topik")]));
    await userEvent.click(screen.getByRole("tab", { name: "TOPIK" }));
    await waitFor(() =>
      expect(lectures).toHaveBeenLastCalledWith("track_topik"),
    );
    expect(await screen.findByText("Lecture topik-1")).toBeInTheDocument();
  });

  it("shows resume/completed markers from the lightweight flags", async () => {
    lectures.mockResolvedValue(
      feed([
        lecture("fresh"),
        lecture("resume", "track_conversation", { started: true }),
        lecture("done", "track_conversation", { started: true, completed: true }),
      ]),
    );
    renderPage();
    await screen.findByText("Lecture fresh");
    expect(screen.getByLabelText(/Lecture resume, 이어보기/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lecture done, 완료/)).toBeInTheDocument();
  });

  it("empty banners + lectures: banner empty view + lecture sections still render", async () => {
    banners.mockResolvedValue({ banners: [] });
    const { container } = renderPage();
    expect(await screen.findByText("표시할 배너가 없어요")).toBeInTheDocument();
    expect(await screen.findByText("Lecture conv-1")).toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
  });

  it("banners + empty lectures: carousel stays, lecture empty view", async () => {
    lectures.mockResolvedValue(feed([]));
    const { container } = renderPage();
    expect(await screen.findByText("아직 등록된 강의가 없어요")).toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
  });

  it("both empty: both empty views appear independently", async () => {
    banners.mockResolvedValue({ banners: [] });
    lectures.mockResolvedValue(feed([]));
    renderPage();
    expect(await screen.findByText("표시할 배너가 없어요")).toBeInTheDocument();
    expect(await screen.findByText("아직 등록된 강의가 없어요")).toBeInTheDocument();
  });

  it("banner loading does not flash the banner empty copy", async () => {
    banners.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    await screen.findByText("Lecture conv-1"); // lectures settle
    expect(container.querySelector(".lechome__banner-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
  });

  it("lecture loading does not flash the empty copy", async () => {
    lectures.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    await waitFor(() =>
      expect(container.querySelector(".lechome__banners")).toBeInTheDocument(),
    );
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__course-empty")).not.toBeInTheDocument();
  });

  it("banner error hides the banner region without showing empty copy", async () => {
    banners.mockRejectedValue(new Error("offline"));
    const { container } = renderPage();
    expect(await screen.findByText("Lecture conv-1")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
  });

  it("lecture error shows retry, not the empty copy", async () => {
    lectures.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("강의를 불러오지 못했어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
  });

  it("a single banner renders no pagination dots (no auto-slide)", async () => {
    banners.mockResolvedValue({ banners: [banner("only")] });
    const { container } = renderPage();
    await screen.findByText("Lecture conv-1");
    expect(container.querySelector(".lechome__banners")).toBeInTheDocument();
    expect(container.querySelector(".lechome__dot")).not.toBeInTheDocument();
  });

  it("keeps the floating chatbot button in the empty states", async () => {
    banners.mockResolvedValue({ banners: [] });
    lectures.mockResolvedValue(feed([]));
    renderPage();
    await screen.findByText("아직 등록된 강의가 없어요");
    expect(
      screen.getByRole("button", { name: "AI 챗봇과 자유롭게 대화하기" }),
    ).toBeInTheDocument();
  });
});
