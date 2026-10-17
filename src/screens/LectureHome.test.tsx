import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

/* -------------------------------- mocks --------------------------------- */
const { banners, summary, courses } = vi.hoisted(() => ({
  banners: vi.fn(),
  summary: vi.fn(),
  courses: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  bannerApi: { list: banners },
  dashboardApi: { summary },
  learnApi: { courses },
}));

import { LectureHome } from "./LectureHome";
import { I18nProvider } from "../i18n";

const banner = (id: string) => ({
  banner_id: id,
  image_url: `http://x/${id}.png`,
  alt_text: `배너 ${id}`,
  action_url: null,
  sort_order: 0,
});
const series = (id: string, extra: Record<string, unknown> = {}) => ({
  series_id: id,
  course_id: "C1",
  title: `Series ${id}`,
  description: "",
  thumbnail_url: `http://x/${id}.png`,
  lesson_count: 3,
  completed_lesson_count: 0,
  started: false,
  has_free_lesson: true,
  ...extra,
});
const course = (id: string, title: string, track: string, items: ReturnType<typeof series>[]) => ({
  course_id: id,
  track_id: track,
  title,
  description: null,
  cover_image_url: null,
  lesson_count: items.reduce((n, s) => n + s.lesson_count, 0),
  completed_lesson_count: 0,
  series: items,
});
const page = (items: unknown[]) => ({ items, next_cursor: null, has_more: false });

const CATALOG = page([
  course("C1", "Speak Korean Instantly", "track_conversation", [
    series("S1", { title: "KOREAN SURVIVAL KIT" }),
    series("S2", { title: "KOREAN ICEBREAKER KIT" }),
  ]),
  course("C2", "TOPIK 1급 입문", "track_topik", [series("S3", { course_id: "C2", title: "TOPIK 듣기" })]),
]);

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nProvider language="ko">
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/courses"]}>
          <Routes>
            <Route path="/courses" element={<LectureHome />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  summary.mockResolvedValue({ streak_days: 3, studied_today: true, paywall_required: true });
  banners.mockResolvedValue({ banners: [banner("b1"), banner("b2")] });
  courses.mockResolvedValue(CATALOG);
});

describe("LectureHome — courses and their series (COU-001)", () => {
  it("shows a section per course with its series as a row of cards", async () => {
    renderPage();
    const first = await screen.findByRole("region", { name: "Speak Korean Instantly" });
    expect(screen.getByRole("region", { name: "TOPIK 1급 입문" })).toBeInTheDocument();
    const cards = first.querySelectorAll(".lechome__row .lechome__card");
    expect([...cards].map((c) => c.getAttribute("aria-label"))).toEqual([
      "KOREAN SURVIVAL KIT, 무료 강의",
      "KOREAN ICEBREAKER KIT, 무료 강의",
    ]);
    // Each series shows its own key art.
    expect(first.querySelector(".lechome__thumb-img")).toHaveAttribute("src", "http://x/S1.png");
    // Called without a track filter for the "전체" default, in the app's language.
    expect(courses).toHaveBeenCalledWith(undefined, "ko");
  });

  it("opens a series' lesson list", async () => {
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /KOREAN ICEBREAKER KIT/ }));
    expect(await screen.findByTestId("where")).toHaveTextContent("/series/S2");
  });

  it("names a series without key art on its placeholder", async () => {
    courses.mockResolvedValue(
      page([course("C1", "Speak Korean Instantly", "track_conversation", [series("bare", { thumbnail_url: null })])]),
    );
    const { container } = renderPage();
    await screen.findByRole("region", { name: "Speak Korean Instantly" });
    expect(container.querySelector(".lechome__thumb-ph-title")).toHaveTextContent("Series bare");
  });

  it("leaves out courses that have no series to show", async () => {
    courses.mockResolvedValue(
      page([...CATALOG.items, course("C3", "Empty course", "track_topik", [])]),
    );
    renderPage();
    await screen.findByRole("region", { name: "Speak Korean Instantly" });
    expect(screen.queryByRole("region", { name: "Empty course" })).toBeNull();
  });

  it("track filter chips re-query with the track query param", async () => {
    renderPage();
    await screen.findByLabelText(/KOREAN SURVIVAL KIT/);
    courses.mockResolvedValue(page([CATALOG.items[1]]));
    await userEvent.click(screen.getByRole("tab", { name: "토픽" }));
    await waitFor(() => expect(courses).toHaveBeenLastCalledWith("track_topik", "ko"));
    expect(await screen.findByLabelText(/TOPIK 듣기/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/KOREAN SURVIVAL KIT/)).toBeNull();
  });

  it("reads out resume/completed from the series' progress without drawing it on the card", async () => {
    courses.mockResolvedValue(
      page([
        course("C1", "Speak Korean Instantly", "track_conversation", [
          series("fresh"),
          series("resume", { started: true }),
          series("done", { started: true, completed_lesson_count: 3 }),
        ]),
      ]),
    );
    const { container } = renderPage();
    await screen.findByLabelText(/Series fresh/);
    expect(screen.getByLabelText(/Series resume, 이어보기/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Series done, 완료/)).toBeInTheDocument();
    // The chip at the bottom of the art is the level's (COU-001), not progress.
    expect(container.querySelector(".lechome__level")).toBeNull();
  });

  it("shows each series' level chip in English, as the design draws it in every language", async () => {
    courses.mockResolvedValue(
      page([
        course("C1", "Speak Korean Instantly", "track_conversation", [
          series("b", { level: "beginner" }),
          series("i", { level: "intermediate", started: true }),
          series("a", { level: "advanced", has_free_lesson: false }),
          series("none", { level: null }),
        ]),
      ]),
    );
    const { container } = renderPage();
    await screen.findByLabelText(/Series b/);
    const chips = [...container.querySelectorAll(".lechome__level")].map((c) => c.textContent);
    expect(chips).toEqual(["Beginner", "Intermediate", "Advanced"]);
    // Screen readers hear it in the app's language, with progress and Free after it.
    expect(screen.getByLabelText("Series b, 초급, 무료 강의")).toBeInTheDocument();
    expect(screen.getByLabelText("Series i, 중급, 이어보기, 무료 강의")).toBeInTheDocument();
    expect(screen.getByLabelText("Series a, 고급")).toBeInTheDocument();
    expect(screen.getByLabelText("Series none, 무료 강의")).toBeInTheDocument();
  });

  it("tags a series with a free lesson for a member without premium access", async () => {
    courses.mockResolvedValue(
      page([
        course("C1", "Speak Korean Instantly", "track_conversation", [
          series("free"),
          series("paid", { has_free_lesson: false }),
        ]),
      ]),
    );
    renderPage();
    expect(await screen.findByLabelText("Series free, 무료 강의")).toBeInTheDocument();
    expect(screen.getByLabelText("Series paid")).toBeInTheDocument();
  });

  it("drops the Free tag for a member with premium access", async () => {
    // Regression: premium was read from `is_premium` on /subscriptions/me,
    // which the server never sends — so paid and coupon members were treated
    // as free. The dashboard's paywall_required is the live check.
    summary.mockResolvedValue({ streak_days: 3, studied_today: true, paywall_required: false });
    renderPage();
    expect(await screen.findByLabelText("KOREAN SURVIVAL KIT")).toBeInTheDocument();
    expect(screen.queryByLabelText(/무료 강의/)).not.toBeInTheDocument();
  });
});

describe("LectureHome — banner carousel (COU-001)", () => {
  it.each([
    ["without premium access", true],
    ["with premium access", false],
  ])("shows the banners to a member %s — the app has no ad-free tier", async (_who, paywallRequired) => {
    summary.mockResolvedValue({ streak_days: 3, studied_today: true, paywall_required: paywallRequired });
    const { container } = renderPage();
    const carousel = await screen.findByRole("region", { name: "배너" });
    await waitFor(() => expect(container.querySelectorAll(".lechome__banner")).toHaveLength(2));
    expect(carousel).toHaveAttribute("aria-roledescription", "carousel");
    expect(screen.getByLabelText(/배너 b1/)).toBeInTheDocument();
  });

  it("puts each banner in its own full-width slide, one card per slide, with a dot each", async () => {
    // Regression: the cards sat edge to edge in one padded track, so the next
    // banner peeked in beside the current one.
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelectorAll(".lechome__banner")).toHaveLength(2));
    const slides = [...container.querySelectorAll(".lechome__banners > .lechome__slide")];
    expect(slides).toHaveLength(2);
    for (const slide of slides) expect(slide.querySelectorAll(".lechome__banner")).toHaveLength(1);
    // The dots sit over the band (laid on the card's foot), one per banner.
    const dots = container.querySelectorAll(".lechome__carousel > .lechome__dots .lechome__dot");
    expect(dots).toHaveLength(2);
    expect(dots[0]).toHaveClass("is-active");
  });

  describe("stays on one whole banner (back from the player)", () => {
    // jsdom has no layout: give the band a width and a scrollTo that moves it.
    let width = 375;
    beforeEach(() => {
      width = 375;
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get(this: HTMLElement) {
          return this.classList.contains("lechome__banners") ? width : 0;
        },
      });
      Element.prototype.scrollTo = function (this: Element, opts?: ScrollToOptions | number) {
        if (typeof opts === "object" && opts.left !== undefined) this.scrollLeft = opts.left;
      } as Element["scrollTo"];
    });
    afterEach(() => {
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    });

    async function band() {
      const { container } = renderPage();
      await waitFor(() => expect(container.querySelector(".lechome__banners")).toBeInTheDocument());
      const el = container.querySelector(".lechome__banners") as HTMLDivElement;
      const dots = () => [...container.querySelectorAll(".lechome__dot")].map((d) => d.classList.contains("is-active"));
      return { el, dots };
    }

    it("a scroll that stops between two banners settles exactly on the nearer one", async () => {
      const { el, dots } = await band();
      el.scrollLeft = 260; // cut short 70% of the way to banner 2
      fireEvent.scroll(el);
      await waitFor(() => expect(el.scrollLeft).toBe(375));
      expect(dots()).toEqual([false, true]);
    });

    it("re-aligns on the same banner when the width changes (rotated while the lesson played)", async () => {
      const { el, dots } = await band();
      el.scrollLeft = 375;
      fireEvent.scroll(el);
      await waitFor(() => expect(dots()).toEqual([false, true]));
      await new Promise((r) => setTimeout(r, 200)); // the swipe settles
      // Back in portrait: the old offset now sits between banners on a wider band.
      width = 430;
      fireEvent(window, new Event("resize"));
      expect(el.scrollLeft).toBe(430);
      expect(dots()).toEqual([false, true]);
    });
  });
});

describe("LectureHome — banners and empty states", () => {
  it("empty banners + courses: banner empty view + course sections still render", async () => {
    banners.mockResolvedValue({ banners: [] });
    const { container } = renderPage();
    expect(await screen.findByText("표시할 배너가 없어요")).toBeInTheDocument();
    expect(await screen.findByLabelText(/KOREAN SURVIVAL KIT/)).toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
  });

  it("banners + no courses: carousel stays, course empty view", async () => {
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

  it("banner loading does not flash the banner empty copy", async () => {
    banners.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    await screen.findByLabelText(/KOREAN SURVIVAL KIT/); // courses settle
    expect(container.querySelector(".lechome__banner-skeleton")).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
  });

  it("course loading does not flash the empty copy", async () => {
    courses.mockReturnValue(new Promise(() => {})); // pending
    const { container } = renderPage();
    await waitFor(() => expect(container.querySelector(".lechome__banners")).toBeInTheDocument());
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__course-empty")).not.toBeInTheDocument();
  });

  it("banner error hides the banner region without showing empty copy", async () => {
    banners.mockRejectedValue(new Error("offline"));
    const { container } = renderPage();
    expect(await screen.findByLabelText(/KOREAN SURVIVAL KIT/)).toBeInTheDocument();
    expect(screen.queryByText("표시할 배너가 없어요")).not.toBeInTheDocument();
    expect(container.querySelector(".lechome__banners")).not.toBeInTheDocument();
  });

  it("course error shows retry, not the empty copy", async () => {
    courses.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("강의를 불러오지 못했어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.queryByText("아직 등록된 강의가 없어요")).not.toBeInTheDocument();
  });

  it("opens a banner's in-app destination on tap, Enter or Space", async () => {
    banners.mockResolvedValue({ banners: [{ ...banner("b1"), action_url: "/subscription" }] });
    renderPage();
    const link = await screen.findByRole("button", { name: /배너 b1/ });
    expect(link).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(link, { key: " " });
    expect(await screen.findByTestId("where")).toHaveTextContent("/subscription");
  });

  it.each([["https://example.com/sale"], ["//example.com"], ["/\\example.com"]])(
    "leaves a banner pointing at %s a plain picture, not a dead button",
    async (url) => {
      banners.mockResolvedValue({ banners: [{ ...banner("b1"), action_url: url }] });
      const { container } = renderPage();
      const pic = await screen.findByRole("img", { name: /배너 b1/ });
      expect(pic).not.toHaveClass("is-link");
      expect(pic).toHaveAttribute("tabindex", "-1");
      fireEvent.click(pic);
      fireEvent.keyDown(pic, { key: "Enter" });
      expect(screen.queryByTestId("where")).not.toBeInTheDocument();
      expect(container.querySelector(".lechome__banner")).toBe(pic);
    },
  );

  it("a single banner renders no pagination dots (no auto-slide)", async () => {
    banners.mockResolvedValue({ banners: [banner("only")] });
    const { container } = renderPage();
    await screen.findByLabelText(/KOREAN SURVIVAL KIT/);
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
