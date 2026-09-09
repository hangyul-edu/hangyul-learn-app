/**
 * FAQ-004 (Figma 570:19949) — the FAQ detail screen, measured against the frame.
 *
 * This renders the real `FaqDetail` with the shipped stylesheets attached and
 * reads computed styles off the actual nodes, rather than grepping the CSS: a
 * rule can be perfectly correct and still be overridden on the element that
 * matters. jsdom resolves the cascade for these (non-layout) properties, so the
 * values here are what the browser would apply, though jsdom does not lay out —
 * geometry that depends on layout is asserted through the properties that
 * decide it.
 *
 * Frame reference (375-wide):
 *   top nav   50 tall at y=44, title "FAQ" SemiBold 15/22.25 #262C31
 *   question  (20, 121) SemiBold 15, leading 1.435, tracking -0.15, #262C31,
 *             with the "Q." run in #547CF1
 *   answer    card x=13 w=350 y=158, #F4F4F5, radius 5, padding 20/5,
 *             inner text block 320 wide, Medium 12/20, tracking -0.5, black
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// @ts-expect-error - @types/node is not a dependency; the runner is Node.
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "../i18n";
import type { AppLanguage } from "../lib/language";

// Read from disk: a CSS import resolves to an empty string under `css: false`,
// which would make every assertion below pass for the wrong reason.
const THEME: string = readFileSync("src/styles/theme.css", "utf8");
const GLOBAL: string = readFileSync("src/styles/global.css", "utf8");

const faq = vi.fn();
vi.mock("../api/endpoints", () => ({
  supportApi: { faq: (...a: unknown[]) => faq(...a), faqs: vi.fn() },
}));
vi.mock("../components/faq/SupportChatButton", () => ({
  SupportChatButton: () => (
    // The frame's orange chat button. Rendered as the plain element the real
    // component produces, so its styling is measured without the auth tree.
    <button type="button" className="faq__support">
      <span className="faq__support-icon">💬</span>
      채팅 상담하기
    </button>
  ),
}));

const { FaqDetail } = await import("./FaqDetail");

const ANSWER = [
  "프리미엄 구독을 시작하시면 7일 무료 체험이 자동으로 적용됩니다.",
  "",
  "- 대상: 프리미엄 신규 구독 회원 전원",
  "- 기간: 구독 시작일로부터 7일",
  "- 혜택: 프리미엄 전체 기능 제한 없이 이용 가능",
  "",
  "무료 체험을 이용 중인 경우, 체험 기간이 종료되는 시점에 자동으로 결제가 진행됩니다.",
].join("\n");

beforeAll(() => {
  for (const css of [THEME, GLOBAL]) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }
});

beforeEach(() => {
  faq.mockReset();
  faq.mockResolvedValue({
    faq_id: "faq_1",
    category: "payments_subscriptions_refunds",
    question: "구독은 언제 결제 되나요?",
    answer: ANSWER,
    locale: "ko",
  });
});

async function mount(language: AppLanguage = "ko") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={qc}>
      <I18nProvider language={language}>
        <MemoryRouter initialEntries={["/faq/faq_1"]}>
          <Routes>
            <Route path="/faq/:faqId" element={<FaqDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
  await screen.findByText(/구독은 언제 결제 되나요\?/);
  return view;
}

const styleOf = (el: Element | null) => getComputedStyle(el as Element);
const q = (sel: string) => document.querySelector(sel);

describe("FAQ-004 — stylesheet is actually loaded", () => {
  it("has the shipped CSS attached to these nodes", async () => {
    await mount();
    expect(GLOBAL.length).toBeGreaterThan(10_000);
    // If the stylesheet were missing, this would be "" and every colour and
    // size assertion below would silently pass against empty strings.
    expect(styleOf(q(".faq__answer")).backgroundColor).not.toBe("");
  });
});

describe("FAQ-004 — header", () => {
  it("shows the centred FAQ title and a back control", async () => {
    await mount();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /뒤로|back/i })).toBeInTheDocument();
  });
});

describe("FAQ-004 — question line", () => {
  it("uses the frame's typography", async () => {
    await mount();
    const heading = styleOf(q(".faq__detail-q"));
    expect(heading.fontSize).toBe("15px");
    expect(heading.fontWeight).toBe("600");
    expect(heading.lineHeight).toBe("1.435");
    expect(heading.letterSpacing).toBe("-0.15px");
    expect(heading.color).toBe("rgb(38, 44, 49)"); // #262C31
  });

  it("sets the Q. run in the frame's blue at the question's own size", async () => {
    await mount();
    expect(q(".faq__detail-q-prefix"), "detail Q. uses its own class").not.toBeNull();
    const prefix = styleOf(q(".faq__detail-q-prefix"));
    expect(prefix.color).toBe("rgb(84, 124, 241)"); // #547CF1
    // The frame runs "Q." and the question as one 15px text run, so the prefix
    // must carry no size of its own and inherit the heading's. jsdom does not
    // resolve inherited values, so "" is exactly that: nothing overrides it.
    // Before the fix this read 13px, inherited from the list-row rule.
    expect(prefix.fontSize).toBe("");
    expect(prefix.letterSpacing).toBe("");
    // …and the coupling to the list row is gone for good.
    expect(q(".faq__detail-q .faq__q-prefix")).toBeNull();
  });

  it("never truncates the question with an ellipsis", async () => {
    // The list row clips to one line; the detail page must show all of it.
    await mount();
    const text = styleOf(q(".faq__detail-q > span:last-child"));
    expect(text.whiteSpace).not.toBe("nowrap");
    expect(text.textOverflow).not.toBe("ellipsis");
  });

  it("sits 20px from the frame edge and 15px above the answer card", async () => {
    await mount();
    // 13px container padding + 7px on the heading = the frame's x=20.
    expect(styleOf(q(".faq__detail")).paddingLeft).toBe("13px");
    expect(styleOf(q(".faq__detail-q")).paddingLeft).toBe("7px");
    expect(styleOf(q(".faq__detail-q")).marginBottom).toBe("15px");
    expect(styleOf(q(".faq__detail")).paddingTop).toBe("27px");
  });
});

describe("FAQ-004 — answer card", () => {
  it("matches the frame's panel treatment", async () => {
    await mount();
    const card = styleOf(q(".faq__answer"));
    expect(card.backgroundColor).toBe("rgb(244, 244, 245)"); // #F4F4F5
    expect(card.borderRadius).toBe("5px");
    expect(card.paddingTop).toBe("20px");
    // 13 (.faq__detail) + 15 = the frame's 28 from the screen edge. The frame
    // shows 5 padding + a centred 320 block; the 15 of slack is really padding.
    expect(card.paddingLeft).toBe("15px");
    expect(card.paddingRight).toBe("15px");
    // No border in the frame — the panel is a fill, not an outline.
    expect(card.borderTopWidth === "" || card.borderTopWidth === "0px").toBe(true);
  });

  it("matches the frame's body typography", async () => {
    await mount();
    const card = styleOf(q(".faq__answer"));
    expect(card.fontSize).toBe("12px");
    expect(card.fontWeight).toBe("500");
    expect(card.lineHeight).toBe("20px");
    expect(card.letterSpacing).toBe("-0.5px");
    expect(card.color).toBe("rgb(0, 0, 0)");
  });

  it("left-aligns the body instead of centring it", async () => {
    await mount();
    const card = styleOf(q(".faq__answer"));
    // The regression: a fixed-width child centred in the card. That put the
    // text's left edge at the mercy of the card's width, so it only lined up at
    // exactly 375 and drifted inward on every wider phone.
    expect(card.alignItems).not.toBe("center");
    expect(card.justifyContent).not.toBe("center");
    expect(card.textAlign).not.toBe("center");

    const block = styleOf(q(".faq__answer-p"));
    expect(block.width).not.toBe("320px");
    // No `margin: 0 auto` centring either.
    expect(block.marginLeft === "" || block.marginLeft === "0px").toBe(true);
    expect(block.marginRight === "" || block.marginRight === "0px").toBe(true);
  });

  it("starts every block at the same left edge, at any width", async () => {
    await mount();
    // Paragraphs and lists must share one left edge — the card's padding — so
    // multi-line text wraps back to it rather than to a centred block's edge.
    for (const sel of [".faq__answer-p", ".faq__answer-list"]) {
      const el = styleOf(q(sel));
      expect(el.marginLeft === "" || el.marginLeft === "0px").toBe(true);
      expect(el.width).not.toBe("320px");
    }
    // Nothing pins a fixed width on the card's children any more.
    expect(GLOBAL).not.toContain(".faq__answer > * {");
  });

  it("renders paragraphs and bullets as the frame shows them", async () => {
    await mount();
    expect(q(".faq__answer-list")).not.toBeNull();
    expect(document.querySelectorAll(".faq__answer-list li")).toHaveLength(3);
    expect(document.querySelectorAll(".faq__answer-p").length).toBeGreaterThanOrEqual(2);
    expect(styleOf(q(".faq__answer-list")).paddingLeft).toBe("18px");
  });

  it("wraps long Korean text instead of overflowing", async () => {
    await mount();
    const card = styleOf(q(".faq__answer"));
    expect(["anywhere", "break-word"]).toContain(card.overflowWrap);
  });
});

describe("FAQ-004 — page chrome", () => {
  it("puts the answer on a white page", async () => {
    await mount();
    expect(styleOf(q(".faq")).backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("styles the floating chat button as the frame's primary pill", async () => {
    await mount();
    const btn = styleOf(q(".faq__support"));
    // jsdom does not resolve var() inside these declarations, so the colour is
    // checked through the token it points at.
    expect(btn.background).toContain("var(--brand-500)");
    expect(THEME).toContain("--brand-500: #ff6700");
    expect(btn.borderRadius).toBe("var(--r-sm)"); // 12px in theme.css
    expect(btn.gap).toBe("7px");
    expect(btn.fontWeight).toBe("700");
    expect(btn.fontSize).toBe("15px");
    expect(btn.color).toBe("rgb(255, 255, 255)");
    expect(THEME).toContain("--r-sm: 12px");
  });

  it("keeps the scroll area clear of the floating button", async () => {
    await mount();
    // Bottom clearance so the last line of an answer is never covered.
    expect(styleOf(q(".faq__scroll")).paddingBottom).toContain("96px");
  });
});

describe("FAQ-004 — localization is unaffected", () => {
  it("still requests the FAQ in the app's language", async () => {
    await mount("ko");
    expect(faq).toHaveBeenCalledWith("faq_1", "ko");
  });
});
