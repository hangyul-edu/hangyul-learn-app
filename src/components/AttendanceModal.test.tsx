import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AttendanceModal } from "./AttendanceModal";

function renderModal(props: Partial<Parameters<typeof AttendanceModal>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <AttendanceModal
      pointsAwarded={5}
      streakDays={3}
      lang="ko"
      onClose={onClose}
      {...props}
    />,
  );
  return { onClose };
}

describe("AttendanceModal", () => {
  it("renders the points badge and streak from props (Korean)", () => {
    renderModal({ pointsAwarded: 5, streakDays: 3, lang: "ko" });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("+5P")).toBeInTheDocument();
    expect(within(dialog).getByText("오늘 출석 완료!")).toBeInTheDocument();
    expect(within(dialog).getByText("연속 3일 달성")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "출석 완료 확인" })).toBeInTheDocument();
  });

  it("renders English copy and the actual (non-hardcoded) point/streak values", () => {
    renderModal({ pointsAwarded: 15, streakDays: 7, lang: "en" });
    expect(screen.getByText("+15P")).toBeInTheDocument();
    expect(screen.getByText("Today's attendance is complete!")).toBeInTheDocument();
    expect(screen.getByText("7-day streak achieved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm attendance completion" })).toBeInTheDocument();
  });

  it("closes via the Confirm button", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "출석 완료 확인" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes via the top-right X button", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "출석 완료 창 닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", async () => {
    const { onClose } = renderModal();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is a modal dialog and blocks background scrolling while open", () => {
    const { unmount } = render(
      <AttendanceModal pointsAwarded={5} streakDays={1} lang="ko" onClose={() => {}} />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    // Scroll lock is released on close.
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
