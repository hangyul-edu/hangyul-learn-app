/**
 * The FAQ flow is More → FAQ-001 → FAQ-002 or FAQ-(empty).
 *
 * FAQ-001 (the search field + the fixed category list) is a client-side screen.
 * It is always the first stop and never skipped, whatever the API says — the
 * category list is hardcoded, so it does not even ask. Whether there is content
 * is a question for the level below: tapping a category gives FAQ-002 when that
 * category has questions and FAQ-(empty) when it does not.
 *
 * FAQ-(empty) is Figma 3393:27173 (ko) / 3393:27288 (en): one Gray 5 line,
 * centred, with the search band kept and no heading, illustration or button.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import userEvent from "@testing-library/user-event";
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

const { Faq } = await import("./Faq");

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

describe("More → FAQ-001", () => {
  it("lands on the category list, not on a deeper screen", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await waitFor(() =>
      expect(container.querySelectorAll(".faq__cat-card").length).toBe(5),
    );
    // FAQ-001 is where the flow starts: no question list, no empty line.
    expect(screen.queryByText(KO_EMPTY)).not.toBeInTheDocument();
    expect(container.querySelectorAll(".faq__q-card")).toHaveLength(0);
  });

  it("is never skipped because the catalogue happens to be empty", async () => {
    // The regression this guards: FAQ-001 was replaced by FAQ-(empty) when the
    // API reported nothing, so More jumped straight to the empty screen.
    faqs.mockResolvedValue(empty());
    const { container } = mount(LANDING);
    await waitFor(() =>
      expect(container.querySelectorAll(".faq__cat-card").length).toBe(5),
    );
    expect(screen.queryByText(KO_EMPTY)).not.toBeInTheDocument();
  });

  it("renders client-side, without asking the API anything", async () => {
    // The category list is fixed, so FAQ-001 needs no request — which is what
    // makes it impossible for API state to bypass it.
    faqs.mockResolvedValue(empty());
    mount(LANDING);
    await screen.findByText("🚀");
    expect(faqs).not.toHaveBeenCalled();
  });

  it("keeps the search band", async () => {
    faqs.mockResolvedValue(empty());
    mount(LANDING);
    expect(await screen.findByPlaceholderText("무엇이든 물어보세요")).toBeInTheDocument();
  });

  it("goes one level deeper when a category is tapped", async () => {
    faqs.mockResolvedValue({ items: [ITEM], next_cursor: null });
    mount(LANDING);
    await userEvent.click(await screen.findByText("🚀"));
    // FAQ-002: the category's questions.
    expect(await screen.findByText("가입은 어떻게 하나요?")).toBeInTheDocument();
    expect(faqs).toHaveBeenCalledWith(
      expect.objectContaining({ category: "getting_started" }),
    );
  });
});

describe("FAQ-002 — the category has questions", () => {
  it("heads the list with the category and lists them", async () => {
    faqs.mockResolvedValue({ items: [ITEM], next_cursor: null });
    const { container } = mount(CATEGORY);
    expect(await screen.findByText("가입은 어떻게 하나요?")).toBeInTheDocument();
    expect(container.querySelector(".faq__heading")).not.toBeNull();
    expect(screen.queryByText(KO_EMPTY)).not.toBeInTheDocument();
    // Exactly what the API returned — no filler rows.
    expect(container.querySelectorAll(".faq__q-card")).toHaveLength(1);
  });
});

describe("FAQ-(empty) — the category has none", () => {
  it("shows the frame's line in Korean", async () => {
    faqs.mockResolvedValue(empty());
    mount(CATEGORY);
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();
  });

  it("shows the frame's line in English", async () => {
    faqs.mockResolvedValue(empty());
    mount(CATEGORY, "en");
    expect(await screen.findByText(EN_EMPTY)).toBeInTheDocument();
  });

  it("drops the category heading, as the frame does", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    await screen.findByText(KO_EMPTY);
    expect(container.querySelector(".faq__heading")).toBeNull();
    expect(container.querySelectorAll(".faq__q-card")).toHaveLength(0);
  });

  it("keeps the header and search band", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    await screen.findByText(KO_EMPTY);
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    expect(container.querySelector(".faq__searchbar")).not.toBeNull();
  });

  it("carries no illustration, emoji, title block or button", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    await screen.findByText(KO_EMPTY);
    // The old implementation drew a 💭 over a bold title in `.state`.
    expect(container.querySelector(".state")).toBeNull();
    expect(container.querySelector(".state__emoji")).toBeNull();
    expect(container.querySelector(".faq__empty img")).toBeNull();
    expect(container.querySelectorAll(".faq__empty button")).toHaveLength(0);
    expect(container.querySelector(".faq__empty")!.textContent).toBe(KO_EMPTY);
  });

  it("matches the frame's type, colour and centring", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    await screen.findByText(KO_EMPTY);
    const style = getComputedStyle(container.querySelector(".faq__empty")!);
    expect(style.color).toBe("rgb(119, 128, 136)"); // Gray 5 #778088
    expect(style.fontSize).toBe("15px");
    expect(style.fontWeight).toBe("500"); // Pretendard Medium
    expect(style.lineHeight).toBe("22.3px");
    expect(style.textAlign).toBe("center");
    expect(style.position).toBe("absolute");
    expect(style.left).toBe("50%");
    expect(style.top).toBe("50%");
    expect(style.transform).toBe("translate(-50%, -50%)");
    // Never edge-to-edge on a narrow screen.
    expect(style.width).toBe("calc(100% - 40px)");
    expect(style.maxWidth).toBe("335px");
  });

  it("invents no placeholder questions to avoid the empty screen", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount(CATEGORY);
    await screen.findByText(KO_EMPTY);
    expect(container.textContent).not.toMatch(/샘플|예시|sample|example/i);
  });
});

describe("a search with no matches", () => {
  it("shows the same FAQ-(empty) view, not a search-specific one", async () => {
    faqs.mockResolvedValue(empty());
    const { container } = mount("/faq?q=zzzz");
    expect(await screen.findByText(KO_EMPTY)).toBeInTheDocument();
    // The shared element and treatment — no separate emoji/title block.
    expect(container.querySelector(".faq__empty")).not.toBeNull();
    expect(container.querySelector(".state")).toBeNull();
    expect(container.querySelector(".state__emoji")).toBeNull();
  });
});
