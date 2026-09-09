/**
 * FAQ-(empty) — Figma 3393:27173 (ko) / 3393:27288 (en).
 *
 * The frame is the FAQ landing with nothing registered: the top nav and search
 * band stay, the category cards are gone, and a single Gray 5 line sits centred
 * on the screen. No illustration, no title/description pair, no button.
 *
 * Also pins the trigger: "no FAQs", "still loading" and "the request failed"
 * are three different situations and only the first is an empty state, and the
 * screen never invents placeholder questions to avoid it.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";
import type { Faq as FaqItem } from "../lib/types";

const GLOBAL: string = readFileSync("src/styles/global.css", "utf8");

const faqs = vi.fn();
vi.mock("../api/endpoints", () => ({
  supportApi: { faqs: (...a: unknown[]) => faqs(...a), faq: vi.fn() },
}));
vi.mock("../components/faq/SupportChatButton", () => ({
  SupportChatButton: () => null,
}));

const { Faq, faqLandingState } = await import("./Faq");

const ITEM: FaqItem = {
  faq_id: "faq_1",
  category: "getting_started",
  question: "가입은 어떻게 하나요?",
  answer: "이메일로 가입할 수 있어요.",
  locale: "ko",
};

const KO_EMPTY = "아직 등록된 질문이 없어요";
const EN_EMPTY = "There are no questions here yet";

function mount(url: string, language: AppLanguage = "ko") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider language={language}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/faq" element={<Faq />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const LANDING = "/faq";
const CATEGORY = "/faq?category=getting_started";
const empty = () => ({ items: [], next_cursor: null });

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = GLOBAL;
  document.head.appendChild(style);
});

beforeEach(() => faqs.mockReset());

describe("FAQ-(empty) — content", () => {
  it("shows the frame's line, in the app's language", async () => {
    faqs.mockResolvedValue(empty());
    mount(LANDING, "ko");
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();
  });

  it("shows the English frame's line in English mode", async () => {
    faqs.mockResolvedValue(empty());
    mount(LANDING, "en");
    expect(await screen.findByText(EN_EMPTY)).toBeInTheDocument();
  });

  it("hides the category cards, as the frame does", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    // The frame shows no category list at all when nothing is registered.
    expect(container.querySelectorAll(".faq__cat-card")).toHaveLength(0);
  });

  it("keeps the header and the search band", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("무엇이든 물어보세요")).toBeInTheDocument();
    expect(container.querySelector(".faq__searchbar")).not.toBeNull();
  });

  it("carries no illustration, emoji, heading or button", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    // The previous implementation drew a 💭 in a `.state` block with a title.
    // The frame has none of that — just the sentence.
    expect(container.querySelector(".state")).toBeNull();
    expect(container.querySelector(".state__emoji")).toBeNull();
    expect(container.querySelector(".faq__empty img")).toBeNull();
    expect(container.querySelector(".faq__empty svg")).toBeNull();
    expect(container.querySelectorAll(".faq__empty button")).toHaveLength(0);
    expect(container.querySelector(".faq__empty")!.textContent).toBe(KO_EMPTY);
  });
});

describe("FAQ-(empty) — typography and placement", () => {
  it("matches the frame's type and colour", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    const style = getComputedStyle(container.querySelector(".faq__empty")!);
    expect(style.color).toBe("rgb(119, 128, 136)"); // Gray 5 #778088
    expect(style.fontSize).toBe("15px");
    expect(style.fontWeight).toBe("500"); // Pretendard Medium
    expect(style.lineHeight).toBe("22.3px");
    expect(style.textAlign).toBe("center");
  });

  it("centres on the screen the way the frame does", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    const style = getComputedStyle(container.querySelector(".faq__empty")!);
    // The frame puts it at the frame's own 50%, not in the middle of the space
    // under the search band, so it is positioned rather than laid out in flow.
    expect(style.position).toBe("absolute");
    expect(style.left).toBe("50%");
    expect(style.top).toBe("50%");
    expect(style.transform).toBe("translate(-50%, -50%)");
    // …against .faq, which establishes the containing block.
    expect(getComputedStyle(container.querySelector(".faq")!).position).toBe("relative");
  });

  it("stays inside a narrow screen instead of touching the edges", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    const style = getComputedStyle(container.querySelector(".faq__empty")!);
    expect(style.width).toBe("calc(100% - 40px)");
    expect(style.maxWidth).toBe("335px");
  });
});

describe("shown only when the catalogue is genuinely empty", () => {
  it("does NOT appear once at least one FAQ exists", async () => {
    faqs.mockResolvedValue({ items: [ITEM], next_cursor: null });
    const { container } = mount(LANDING);
    // The catalogue is non-empty, so the landing shows its category cards.
    await waitFor(() =>
      expect(container.querySelectorAll(".faq__cat-card").length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(KO_EMPTY)).not.toBeInTheDocument();
  });

  it("applies the same treatment to an empty category", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();
    expect(container.querySelectorAll(".faq__q-card")).toHaveLength(0);
    expect(container.querySelector(".state__emoji")).toBeNull();
  });
});

describe("which landing state to show", () => {
  // The ordering is the point: only a settled, successful, empty response is an
  // empty catalogue. Asserted on the pure decision rather than by driving a
  // query into each state — the failure path in particular is not reproducible
  // through the query layer here without the rejection being reported as
  // unhandled, which wedges the run.
  it("treats a request in flight as loading, not empty", () => {
    expect(faqLandingState({ isLoading: true, error: null })).toBe("loading");
    // Even if a previous, now-stale empty page is still in the cache.
    expect(
      faqLandingState({ isLoading: true, error: null, data: { items: [] } }),
    ).toBe("loading");
  });

  it("treats a failure as an error, not empty", () => {
    expect(faqLandingState({ isLoading: false, error: new Error("boom") })).toBe(
      "error",
    );
    // A failure that left an empty cached page behind is still an error:
    // claiming "no questions" would be a lie and would hide the retry.
    expect(
      faqLandingState({
        isLoading: false,
        error: new Error("boom"),
        data: { items: [] },
      }),
    ).toBe("error");
  });

  it("is empty only for a settled, successful, empty response", () => {
    expect(
      faqLandingState({ isLoading: false, error: null, data: { items: [] } }),
    ).toBe("empty");
  });

  it("shows the categories as soon as anything is registered", () => {
    expect(
      faqLandingState({ isLoading: false, error: null, data: { items: [1] } }),
    ).toBe("categories");
    // No data yet and not loading (a disabled query) is not an empty catalogue.
    expect(faqLandingState({ isLoading: false, error: null })).toBe("categories");
  });
});

describe("no placeholder content", () => {
  it("renders exactly the FAQs the API returned, and nothing else", async () => {
    faqs.mockResolvedValue({ items: [ITEM], next_cursor: null });
    const { container } = mount(CATEGORY);
    await screen.findByText("가입은 어떻게 하나요?");
    // One card for one FAQ — no sample or filler rows padding the list out.
    expect(container.querySelectorAll(".faq__q-card")).toHaveLength(1);
  });

  it("shows an empty catalogue honestly rather than inventing questions", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await screen.findByText(KO_EMPTY);
    expect(container.textContent).not.toMatch(/샘플|예시|sample|example/i);
  });
});

describe("search keeps its own 'no match' state", () => {
  it("does not claim the catalogue is empty when a search misses", async () => {
    // Searching is a different question from browsing: the catalogue may be
    // full and simply contain no match.
    faqs.mockResolvedValue(empty());
    mount("/faq?q=zzzz");
    expect(await screen.findByText("검색 결과가 없어요")).toBeInTheDocument();
    expect(screen.queryByText(KO_EMPTY)).not.toBeInTheDocument();
  });
});
