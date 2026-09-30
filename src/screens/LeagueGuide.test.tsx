import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LEAGUE_POINT_RULES } from "../lib/league";
import { I18nProvider, translate } from "../i18n";

/** The guide's copy now lives in the catalogs; assert against the Korean. */
const ko = (key: Parameters<typeof translate>[1]) => translate("ko", key);
import { LeagueGuideSheet } from "./LeagueGuide";

function renderGuide() {
  const onClose = vi.fn();
  const utils = render(
    // Assertions are written against the Korean design frames.
    <I18nProvider language="ko">
      <LeagueGuideSheet onClose={onClose} />
    </I18nProvider>,
  );
  return { onClose, ...utils };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Regular League guide sheet", () => {
  it("renders as a modal bottom sheet with rounded top and dimmed backdrop", async () => {
    renderGuide();
    const dialog = screen.getByRole("dialog", { name: "정규 리그 안내" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Slide-up sheet card (not a full-screen page) inside a dimmed overlay.
    expect(dialog).toHaveClass("lgg");
    expect(document.querySelector(".lgg-overlay")).toBeInTheDocument();
    // Focus moved into the sheet (onto the close button).
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "정규 리그 안내 닫기" })));
  });

  it("renders the orange hero (title, left-aligned description, banner)", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "정규 리그" })).toBeInTheDocument();
    expect(within(dialog).getByText(/전 세계 학습자들과 경쟁하며/)).toBeInTheDocument();
    expect(within(dialog).getByText(/도전할수록 더 빠르게 성장할 수 있어요/)).toBeInTheDocument();
    // Banner illustration on the right of the hero.
    expect(dialog.querySelector(".lgg__banner .lgg__banner-art")).toBeInTheDocument();
  });

  it("renders the schedule card with the authoritative season copy", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(ko("league.scheduleRange"))).toBeInTheDocument();
    expect(within(dialog).getByText("(일요일 21시에 결과 발표)")).toBeInTheDocument();
    expect(within(dialog).getByText(/미국 동부 시간\(ET\) 기준/)).toBeInTheDocument();
  });

  it("renders the promotion headline and the five tier ladder with boundary notes", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    const tiers = dialog.querySelector(".lgg__tiers") as HTMLElement;
    expect(within(tiers).getByText(ko("league.promotionHeadline"))).toBeInTheDocument();
    expect(tiers).toHaveAttribute("aria-label", ko("league.promotionAria"));
    // Exactly five tiers in reference order (Green..Golden).
    const names = Array.from(tiers.querySelectorAll(".lgg__tier-name")).map((n) => n.textContent);
    expect(names).toEqual(["Green", "Lime", "Yellow", "Orange", "Golden"]);
    // Boundary notes only on the first (Green) and last (Golden) tiers.
    const greenTier = within(tiers).getByText("Green").closest(".lgg__tier") as HTMLElement;
    const goldenTier = within(tiers).getByText("Golden").closest(".lgg__tier") as HTMLElement;
    expect(within(greenTier).getByText("(강등 없음)")).toBeInTheDocument();
    expect(within(goldenTier).getByText("(승급 없음)")).toBeInTheDocument();
    // Each tier shows its exported Figma citrus artwork (`.citrus > img`).
    expect(tiers.querySelectorAll(".lgg__tier-badge .citrus__art")).toHaveLength(5);
  });

  it("renders the dashed point-section title and the 2x2 point grid in order", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("학습할수록 리그 점수(P)가 올라가요")).toBeInTheDocument();
    // Exactly four point cards, in reference order.
    const grid = dialog.querySelector(".lgg__grid") as HTMLElement;
    const labels = Array.from(grid.querySelectorAll(".lgg__pt-label")).map((n) => n.textContent);
    expect(labels).toEqual(["출석", "맞춤 학습", "강의", "복습"]);
  });

  it("shows each point card's real value and bonus copy from the policy source", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    // Values come straight from LEAGUE_POINT_RULES (mirrors backend POINT_RULES).
    LEAGUE_POINT_RULES.forEach((rule) => {
      const card = within(dialog).getByText(ko(rule.label)).closest(".lgg__pt") as HTMLElement;
      expect(within(card).getByText(rule.points)).toBeInTheDocument();
      rule.details.forEach((detail) =>
        expect(within(card).getByText(ko(detail))).toBeInTheDocument(),
      );
      // Card announces the full activity for screen readers.
      expect(card).toHaveAttribute("aria-label", ko(rule.aria));
    });
  });

  it("explains that an attendance day ends at midnight in the device's time zone", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    const card = within(dialog).getByText(ko("league.ruleAttendance")).closest(".lgg__pt") as HTMLElement;
    expect(within(card).getByText("하루 1회, 현재 기기 시간대 기준 자정에 초기화")).toBeInTheDocument();
  });

  it("scrolls as a single vertical surface (no nested scroll containers)", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    const scrollers = dialog.querySelectorAll(".lgg__scroll");
    expect(scrollers).toHaveLength(1);
  });

  it("dismisses (animated) via the close button", async () => {
    const { onClose } = renderGuide();
    await userEvent.click(screen.getByRole("button", { name: "정규 리그 안내 닫기" }));
    // Exit animation state applied, then onClose fires.
    expect(document.querySelector(".lgg.is-closing")).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("dismisses on hardware/browser back", async () => {
    const { onClose } = renderGuide();
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("ignores repeated close taps (single onClose)", async () => {
    const { onClose } = renderGuide();
    const btn = screen.getByRole("button", { name: "정규 리그 안내 닫기" });
    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks background interaction by locking body scroll while open", () => {
    const { unmount } = renderGuide();
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
