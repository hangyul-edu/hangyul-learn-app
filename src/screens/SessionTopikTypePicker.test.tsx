import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/* The type picker lives in SessionChrome's `panel` slot, so unlike the other
   SessionTopik suites this mock must render that prop — dropping it would hide
   the very thing under test. */
vi.mock("../components/SessionChrome", () => ({
  SessionChrome: ({ panel, children }: { panel?: ReactNode; children?: ReactNode }) => (
    <div>
      {panel}
      {children}
    </div>
  ),
}));
vi.mock("../components/SessionCompleteModal", () => ({ SessionCompleteModal: () => null }));
vi.mock("../hooks/toast", () => ({ useToast: () => ({ error: vi.fn(), success: vi.fn() }) }));
vi.mock("../hooks/auth", () => ({ useAuth: () => ({ me: { app_language: "ko" } }) }));

const { questions, topikTypes, summary } = vi.hoisted(() => ({
  questions: vi.fn(),
  topikTypes: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("../api/endpoints", () => ({
  recApi: { questions, topikQuestionTypes: topikTypes },
  quizApi: { attempt: vi.fn(), audio: vi.fn(), bookmark: vi.fn(), unbookmark: vi.fn() },
  dashboardApi: { summary },
  learnApi: { recordSession: vi.fn() },
}));

import { SessionTopik } from "./SessionTopik";
import { I18nProvider } from "../i18n";

/** Two real entries from TOPIK_QUESTION_TYPES — the API sends both titles. */
const TYPES = [
  {
    code: "reading_01",
    section: "reading",
    number_label: "01",
    title_en: "Choose the correct grammar for the blank",
    title_ko: "빈칸에 알맞은 문법 고르기",
  },
  {
    code: "reading_03",
    section: "reading",
    number_label: "03",
    title_en: "Identify the topic",
    title_ko: "주제 고르기",
  },
];

const QUESTION = {
  quiz_id: "q1",
  question_type: "reading_01",
  prompt: "빈칸에 알맞은 것을 고르십시오.",
  level: 3,
  material: { kind: "text", html: null, image_url: null, audio: null },
  answer: {
    format: "single_choice",
    choices: [{ key: "1", text: "가" }, { key: "2", text: "나" }],
    blanks: [],
  },
};

function renderScreen(language: "ko" | "en") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: <SessionTopik /> }], {
    initialEntries: [{ pathname: "/", state: { section: "reading" } }],
  });
  return render(
    <I18nProvider language={language}>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

async function openPicker() {
  const field = await screen.findByRole("button", { expanded: false });
  await userEvent.click(field);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  summary.mockResolvedValue({
    tracks: [{ category: "topik", level: 3, goal: { target: 3, current: 0, achieved: false } }],
  });
  topikTypes.mockResolvedValue({ section: "reading", items: TYPES });
  questions.mockResolvedValue({ items: [QUESTION] });
});

/* The endpoint returns title_en AND title_ko for every type; the screen used to
   render title_ko unconditionally, leaving English users with Korean type names
   in the picker at the top of the session. */
describe("TOPIK question-type picker follows the app language", () => {
  it("uses the design's English wording, not the API's generator description", async () => {
    renderScreen("en");
    await openPicker();
    // 1916:25797. The API sends "Choose the correct grammar for the blank" and
    // "Identify the topic" — those are LLM prompt descriptions, not UI labels.
    expect(await screen.findByText("[Type 01] Choose the correct grammar")).toBeInTheDocument();
    expect(screen.getByText("[Type 03] Choose the topic")).toBeInTheDocument();
    expect(screen.queryByText(/for the blank/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Identify the topic/)).not.toBeInTheDocument();
  });

  it("never shows a Korean title on an English screen", async () => {
    renderScreen("en");
    await openPicker();
    await screen.findByText("[Type 03] Choose the topic");
    expect(screen.queryByText(/빈칸에 알맞은 문법 고르기/)).not.toBeInTheDocument();
    expect(screen.queryByText(/주제 고르기/)).not.toBeInTheDocument();
  });

  it("uses the design's Korean wording, not the API's description", async () => {
    renderScreen("ko");
    await openPicker();
    // 1916:25746. The API sends "주제 고르기" for reading_03; the frame says 화제.
    expect(await screen.findByText("[유형01] 빈칸에 알맞은 문법 고르기")).toBeInTheDocument();
    expect(screen.getByText("[유형03] 화제 고르기")).toBeInTheDocument();
    expect(screen.queryByText("[유형03] 주제 고르기")).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose the correct grammar/)).not.toBeInTheDocument();
  });

  it("numbers writing types by exam question in both languages", async () => {
    // Writing abandons the [Type NN] / [유형NN] prefix in BOTH frames, and the
    // two disagree on shape: EN 1718:36262 "[Q 53]", KO 1718:36265 "[53번 유형]".
    const writing = {
      section: "writing",
      items: [
        {
          code: "writing_51_52", section: "writing", number_label: "51–52",
          title_en: "Fill in the blanks with appropriate words or expressions",
          title_ko: "빈칸에 알맞은 말 쓰기",
        },
        {
          code: "writing_53", section: "writing", number_label: "53",
          title_en: "Write a passage describing the given data or chart",
          title_ko: "자료를 설명하는 글 쓰기",
        },
      ],
    };
    topikTypes.mockResolvedValue(writing);
    const { unmount } = renderScreen("en");
    await openPicker();
    expect(await screen.findByText("[Q 51,52] Fill in the blanks")).toBeInTheDocument();
    expect(screen.getByText("[Q 53] Write a data description")).toBeInTheDocument();
    // The en-dash number_label must not leak through in either language.
    expect(screen.queryByText(/51–52/)).not.toBeInTheDocument();
    unmount();

    topikTypes.mockResolvedValue(writing);
    renderScreen("ko");
    await openPicker();
    expect(await screen.findByText("[51번, 52번 유형] 빈칸에 알맞은 말 쓰기")).toBeInTheDocument();
    expect(screen.getByText("[53번 유형] 자료를 설명하는 글 쓰기")).toBeInTheDocument();
    expect(screen.queryByText(/유형51|51–52/)).not.toBeInTheDocument();
  });

  it("gives listening its own Korean wording, not reading's", async () => {
    // The shared component's base layer names are reading-flavoured; 1718:36264
    // is the real 듣기 copy and differs from 읽기 at the same type numbers.
    topikTypes.mockResolvedValue({
      section: "listening",
      items: [
        {
          code: "listening_01", section: "listening", number_label: "01",
          title_en: "Choose the matching picture or chart",
          title_ko: "일치하는 그림이나 도표 고르기",
        },
      ],
    });
    renderScreen("ko");
    await openPicker();
    expect(await screen.findByText("[유형01] 일치하는 그림/도표 고르기")).toBeInTheDocument();
    // Reading's [유형01] must not be reused here.
    expect(screen.queryByText(/빈칸에 알맞은 문법 고르기/)).not.toBeInTheDocument();
  });

  it("shows the chosen type in the collapsed field in the app language", async () => {
    renderScreen("en");
    await openPicker();
    await userEvent.click(await screen.findByText("[Type 03] Choose the topic"));
    // The list closes; the field itself now carries the selection.
    const field = document.querySelector(".sess__dropdown-val") as HTMLElement;
    expect(field.textContent).toBe("[Type 03] Choose the topic");
  });

  it("falls back to the generic template for a type added after the map", async () => {
    topikTypes.mockResolvedValue({
      section: "reading",
      items: [{ ...TYPES[0], code: "reading_99", number_label: "99", title_en: "Brand new type" }],
    });
    renderScreen("en");
    await openPicker();
    expect(await screen.findByText("[Type 99] Brand new type")).toBeInTheDocument();
  });

  it("covers every question type the exam defines, in the frames' format", async () => {
    const maps = await import("../lib/topikTypeLabels");
    for (const [lang, map] of [
      ["en", maps.TOPIK_TYPE_LABEL_EN],
      ["ko", maps.TOPIK_TYPE_LABEL_KO],
    ] as const) {
      const codes = Object.keys(map);
      // 12 reading + 11 listening + 3 writing, matching TOPIK_QUESTION_TYPES.
      expect(codes.filter((c) => c.startsWith("reading_")), lang).toHaveLength(12);
      expect(codes.filter((c) => c.startsWith("listening_")), lang).toHaveLength(11);
      expect(codes.filter((c) => c.startsWith("writing_")), lang).toHaveLength(3);

      for (const [code, label] of Object.entries(map)) {
        const writing = code.startsWith("writing_");
        const shape =
          lang === "en"
            ? writing
              ? /^\[Q [\d,]+] \S/
              : /^\[Type \d{2}] \S/
            : writing
              ? /^\[\d+번(, \d+번)* 유형] \S/
              : /^\[유형\d{2}] \S/;
        expect(label, `${lang} ${code}`).toMatch(shape);
        expect(label, `${lang} ${code} has stray whitespace`).toBe(
          label.trim().replace(/\s{2,}/g, " "),
        );
        // Straight apostrophes only — the catalog uses no U+2019.
        expect(label, `${lang} ${code} uses a curly apostrophe`).not.toMatch(/’/);
      }
    }
    // Both languages describe exactly the same set of types.
    expect(Object.keys(maps.TOPIK_TYPE_LABEL_KO).sort()).toEqual(
      Object.keys(maps.TOPIK_TYPE_LABEL_EN).sort(),
    );
  });

  it("shows the localized placeholder before any type is chosen", async () => {
    renderScreen("en");
    // 1924:26394 in TAL-015 — the frame's own placeholder wording.
    expect(
      await screen.findByText("✨ Type a topic you want to focus on"),
    ).toBeInTheDocument();
  });
});
