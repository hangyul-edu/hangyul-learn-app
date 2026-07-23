import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { banners, summary, mine, courses, courseLessons } = vi.hoisted(() => ({
  banners: vi.fn(),
  summary: vi.fn(),
  mine: vi.fn(),
  courses: vi.fn(),
  courseLessons: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  bannerApi: { list: banners },
  dashboardApi: { summary },
  subApi: { mine },
  learnApi: { courses, courseLessons },
}));

// jsdom has no IntersectionObserver (the feed uses it for infinite scroll).
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.IntersectionObserver = IO as unknown as typeof IntersectionObserver;

import { LectureHome } from "./LectureHome";

const banner = (id: string) => ({
  banner_id: id,
  image_url: `http://x/${id}.png`,
  alt_text: `배너 ${id}`,
  action_url: null,
  sort_order: 0,
});
const lecture = (id: string) => ({
  lecture_id: id,
  title: `Lecture ${id}`,
  level: 2,
  access: "free",
  thumbnail_url: null,
});
const course = (id: string, withLessons = true) => ({
  course_id: id,
  track_id: "track_conversation",
  title: `Course ${id}`,
  description: null,
  level: 2,
  cover_image_url: null,
  lesson_count: withLessons ? 1 : 0,
  completed_lesson_count: 0,
  lessons_preview: withLessons ? [lecture(`${id}-l1`)] : [],
  lessons_next_cursor: null,
});
const page = (items: unknown[]) => ({ items, next_cursor: null, has_more: false });

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
  courses.mockResolvedValue(page([course("c1")]));
});

describe("LectureHome empty states", () => {
  it("banners + courses: shows the carousel and the course section", async () => {
    const { container } = renderPage();
    expect(await screen.findByText("Course c1")).toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
  });

  it("empty banners + courses: banner empty view + course section (courses still render)", async () => {
    banners.mockResolvedValue({ banners: [] });
    const { container } = renderPage();
    expect(await screen.findByText("표시할 배너가 없어요")).toBeInTheDocument();
    expect(await screen.findByText("Course c1")).toBeInTheDocument();
    // No carousel DOM (no image, no dots) when empty.
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__dot")).not.toBeInTheDocument();
  });

  it("banners + empty courses: carousel stays, course empty view", async () => {
    courses.mockResolvedValue(page([]));
    const { container } = renderPage();
    expect(await screen.findByText("아직 등록된 강의가 없어요")).toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
  });

  it("both empty: both empty views appear independently", async () => {
    banners.mockResolvedValue({ banners: [] });
    courses.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("표시할 배너가 없어요")).toBeInTheDocument();
    expect(await screen.findByText("아직 등록된 강의가 없어요")).toBeInTheDocument();
  });

  it("categories with empty lecture arrays are treated as empty courses", async () => {
    courses.mockResolvedValue(page([course("c1", false), course("c2", false)]));
    renderPage();
    expect(await screen.findByText("아직 등록된 강의가 없어요")).toBeInTheDocument();
    expect(screen.queryByText("Course c1")).not.toBeInTheDocument(); // heading not rendered
  });

  it("renders only populated categories when some are empty", async () => {
    courses.mockResolvedValue(page([course("c1", false), course("c2", true)]));
    renderPage();
    expect(await screen.findByText("Course c2")).toBeInTheDocument();
    expect(screen.queryByText("Course c1")).not.toBeInTheDocument();
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
  });

  it("banner loading does not flash the banner empty copy", async () => {
    banners.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    await screen.findByText("Course c1"); // courses settle
    expect(container.querySelector(".lechome__banner-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
  });

  it("course loading does not flash the course empty copy", async () => {
    courses.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    // Banners settle (present); the course area stays in its loading state.
    await waitFor(() => expect(container.querySelector(".lechome__banners")).toBeInTheDocument());
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__course-empty")).not.toBeInTheDocument();
  });

  it("banner error hides the banner region without showing empty copy", async () => {
    banners.mockRejectedValue(new Error("offline"));
    const { container } = renderPage();
    expect(await screen.findByText("Course c1")).toBeInTheDocument(); // courses unaffected
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
  });

  it("course error shows retry, not the course empty copy", async () => {
    courses.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("강의를 불러오지 못했어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
  });

  it("a single banner renders no pagination dots (no auto-slide)", async () => {
    banners.mockResolvedValue({ banners: [banner("only")] });
    const { container } = renderPage();
    await screen.findByText("Course c1");
    expect(container.querySelector(".lechome__banners")).toBeInTheDocument();
    expect(container.querySelector(".lechome__dot")).not.toBeInTheDocument();
  });

  it("keeps the floating chatbot button in the empty states", async () => {
    banners.mockResolvedValue({ banners: [] });
    courses.mockResolvedValue(page([]));
    renderPage();
    await screen.findByText("아직 등록된 강의가 없어요");
    expect(screen.getByRole("button", { name: "AI 챗봇과 자유롭게 대화하기" })).toBeInTheDocument();
  });
});
