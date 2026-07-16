import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LEAGUE_POINT_RULES, LEAGUE_PROMOTION } from "../lib/league";
import { LeagueGuideSheet } from "./LeagueGuide";

function renderGuide() {
  const onClose = vi.fn();
  const utils = render(<LeagueGuideSheet onClose={onClose} />);
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
    expect(within(dialog).getByText(/학습 점수로 경쟁하는 리그예요/)).toBeInTheDocument();
    // Banner illustration on the right of the hero.
    expect(dialog.querySelector(".lgg__banner svg")).toBeInTheDocument();
  });

  it("renders the schedule card with the authoritative season copy", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/매주 월요일 00:00 시작/)).toBeInTheDocument();
    expect(within(dialog).getByText(/일요일 21:00 종료/)).toBeInTheDocument();
    expect(within(dialog).getByText("(일요일 21시에 결과 발표)")).toBeInTheDocument();
  });

  it("renders the dashed point-panel heading and the 2x2 reward grid in order", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("학습할수록 리그 점수(P)가 올라가요")).toBeInTheDocument();
    // Exactly four reward cards, in reference order.
    const grid = dialog.querySelector(".lgg__grid") as HTMLElement;
    const labels = Array.from(grid.querySelectorAll(".lgg__reward-label")).map((n) => n.textContent);
    expect(labels).toEqual(["출석", "맞춤 학습", "강의", "복습"]);
  });

  it("shows each reward's real point value and bonus copy from the policy source", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    // Values come straight from LEAGUE_POINT_RULES (mirrors backend POINT_RULES).
    LEAGUE_POINT_RULES.forEach((rule) => {
      const card = within(dialog).getByText(rule.label).closest(".lgg__reward") as HTMLElement;
      expect(within(card).getByText(rule.points)).toBeInTheDocument();
      rule.details.forEach((detail) => expect(within(card).getByText(detail)).toBeInTheDocument());
      // Card announces the full activity for screen readers.
      expect(card).toHaveAttribute("aria-label", rule.aria);
    });
  });

  it("renders the promotion card matching the real league rules", () => {
    renderGuide();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(LEAGUE_PROMOTION.headline)).toBeInTheDocument();
    LEAGUE_PROMOTION.rules.forEach((line) => expect(within(dialog).getByText(line)).toBeInTheDocument());
    const promo = dialog.querySelector(".lgg__promo") as HTMLElement;
    expect(promo).toHaveAttribute("aria-label", LEAGUE_PROMOTION.aria);
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
